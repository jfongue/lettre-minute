import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'

const WORDFREQ_URL = 'https://raw.githubusercontent.com/rspeer/wordfreq/master/wordfreq/data'

/**
 * Just enough MessagePack to read wordfreq's file: arrays, maps, strings and
 * small integers. Pulling a package in for one import script is not worth it.
 */
function unpack(bytes: Buffer): unknown {
  let at = 0
  const text = (length: number) => bytes.toString('utf8', (at += length) - length, at)
  const list = (length: number) => Array.from({ length }, read)
  const map = (length: number) => Object.fromEntries(Array.from({ length }, () => [read(), read()]))
  function read(): unknown {
    const tag = bytes[at++]!
    if (tag <= 0x7f) return tag
    if (tag >= 0xe0) return tag - 0x100
    if ((tag & 0xe0) === 0xa0) return text(tag & 0x1f)
    if ((tag & 0xf0) === 0x90) return list(tag & 0x0f)
    if ((tag & 0xf0) === 0x80) return map(tag & 0x0f)
    switch (tag) {
      case 0xc0: return null
      case 0xc2: return false
      case 0xc3: return true
      case 0xcc: return bytes[at++]
      case 0xcd: return bytes.readUInt16BE((at += 2) - 2)
      case 0xd9: return text(bytes[at++]!)
      case 0xda: return text(bytes.readUInt16BE((at += 2) - 2))
      case 0xdc: return list(bytes.readUInt16BE((at += 2) - 2))
      case 0xdd: return list(bytes.readUInt32BE((at += 4) - 4))
      case 0xde: return map(bytes.readUInt16BE((at += 2) - 2))
      default: throw new Error(`wordfreq: type msgpack 0x${tag.toString(16)} non géré`)
    }
  }
  return read()
}

/**
 * How often each word is used today, per million words, from
 * wordfreq: Wikipedia, OpenSubtitles 2018, news up to 2021, the web, Twitter
 * and Reddit, blended. Books alone print "abeille" or "coccinelle" far less
 * than people say them; the blend is the closer reading of the living language.
 *
 * The file lists words by bucket: bucket i holds every word used 10^(-i/100)
 * of the time.
 */
export async function loadFrequencies(lang: string, path = `.cache/wordfreq-large-${lang}.msgpack.gz`): Promise<Map<string, number>> {
  if (!existsSync(path)) {
    console.log('· wordfreq: téléchargement')
    const response = await fetch(`${WORDFREQ_URL}/large_${lang}.msgpack.gz`, { signal: AbortSignal.timeout(180_000) })
    if (!response.ok) throw new Error(`wordfreq: HTTP ${response.status}`)
    writeFileSync(path, Buffer.from(await response.arrayBuffer()))
  }

  const [header, ...buckets] = unpack(gunzipSync(readFileSync(path))) as [
    { format?: string },
    ...string[][],
  ]
  if (header.format !== 'cB') throw new Error('wordfreq: format inattendu')

  const frequency = new Map<string, number>()
  for (const [index, bucket] of buckets.entries()) {
    const perMillion = 10 ** (-index / 100) * 1_000_000
    for (const spelling of bucket) {
      // Keyed on the exact spelling, accents kept: folded, the sloth "aï"
      // would read as "ai" and the cerium "Ce" as "ce".
      if (!frequency.has(spelling)) frequency.set(spelling, perMillion)
    }
  }
  console.log(`· wordfreq: ${frequency.size} formes`)
  return frequency
}
