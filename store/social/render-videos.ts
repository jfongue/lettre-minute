// Renders the social videos with HyperFrames from the runs capture.ts filmed:
// .cache/social-kit/kit/<lang>/video-<format>-<W>x<H>.mp4, about 22 s, H.264,
// silent (the apps lay their own sound over it). The cuts come from each
// language's marks.json: the title card, the run from the first word typed to
// just after the fourth, the scoring screen, then the end card.
//
//   cd store/social && npm install
//   node render-videos.ts [lang…] [--format=story,square]
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import './copy.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../..')
const COPY = (globalThis as any).COPY as Record<string, { name: string[]; hook: string; tagline: string; cta: string; video: string[] }>
const FORMATS = [
  { format: 'story', width: 1080, height: 1920 },
  { format: 'feed', width: 1080, height: 1350 },
  { format: 'square', width: 1080, height: 1080 },
  { format: 'landscape', width: 1920, height: 1080 },
]
const args = process.argv.slice(2)
const only = args.find((arg) => arg.startsWith('--format='))?.slice('--format='.length).split(',')
const langs = args.filter((arg) => !arg.startsWith('--'))

mkdirSync(join(HERE, 'media'), { recursive: true })
mkdirSync(join(HERE, 'pages'), { recursive: true })
copyFileSync(join(ROOT, 'assets/source/jost.woff2'), join(HERE, 'media/jost.woff2'))
copyFileSync(join(ROOT, 'assets/icon-only.png'), join(HERE, 'media/icon.png'))

const round = (value: number) => Math.round(value * 100) / 100
const escape = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;')

for (const lang of langs.length ? langs : Object.keys(COPY)) {
  const copy = COPY[lang]
  const work = join(ROOT, '.cache/social-kit/work', lang)
  mkdirSync(join(HERE, 'media', lang), { recursive: true })
  copyFileSync(join(work, 'gameplay.mp4'), join(HERE, 'media', lang, 'gameplay.mp4'))
  const marks = JSON.parse(readFileSync(join(work, 'marks.json'), 'utf8'))

  // A run with skipped prompts lasts longer: it keeps its last 15 s.
  const IN_END = 1.8
  const RUN_END = marks.word4 + 0.9
  const RUN_FROM = round(Math.max(marks.run + 0.4, RUN_END - 15))
  const RUN_DUR = round(RUN_END - RUN_FROM)
  const SUM_AT = round(IN_END + RUN_DUR)
  const SUM_DUR = 3.2
  const OUT_AT = round(SUM_AT + SUM_DUR - 0.1)
  const TOTAL = round(OUT_AT + 2.8)
  const third = RUN_DUR / 3
  const T = {
    TOTAL, IN_END: IN_END + 0.4, RUN_AT: IN_END, RUN_DUR, RUN_FROM,
    SUM_AT, SUM_DUR, SUM_FROM: round(marks.timeUp + 3), OUT_AT, OUT_DUR: round(TOTAL - OUT_AT),
    C1: round(IN_END + 0.2), C1_DUR: round(third - 0.2), C2: round(IN_END + third), C2_DUR: round(third),
    C3: round(IN_END + 2 * third), C3_DUR: round(third), C4: round(SUM_AT), C4_DUR: round(SUM_DUR + 0.1),
  }
  console.log(lang, JSON.stringify(T))
  const template = readFileSync(join(HERE, 'video.html'), 'utf8')
  const out = join(ROOT, '.cache/social-kit/kit', lang)
  mkdirSync(out, { recursive: true })
  for (const { format, width, height } of FORMATS.filter(({ format }) => !only || only.includes(format))) {
    const slots: Record<string, string> = {
      W: String(width), H: String(height), FORMAT: format, LANG: lang, TIMES: JSON.stringify(T),
      NAME1: escape(copy.name[0]), NAME2: escape(copy.name[1]), HOOK: escape(copy.hook), // The tagline breaks only between its parts, never inside « 60 secondes ».
      TAGLINE: copy.tagline.split(' · ').map((part) => `<span>${escape(part)}</span>`).join(' · '), CTA: escape(copy.cta),
      // The captions carry their own <br /> and <em>.
      V1: copy.video[0], V2: copy.video[1], V3: copy.video[2], V4: copy.video[3],
      ...Object.fromEntries(Object.entries(T).map(([slot, value]) => [slot, String(value)])),
    }
    const html = template.replace(/\{\{(\w+)\}\}/g, (whole, slot) => slots[slot] ?? whole)
    const page = `pages/${lang}-${format}.html`
    writeFileSync(join(HERE, page), html)
    const raw = join(HERE, `renders/${lang}-${format}.mp4`)
    execFileSync('npx', ['hyperframes', 'render', '.', '-c', page, '-o', raw, '--fps', '30', '--quality', 'delivery', '--video-frame-format', 'png', '--quiet'], { cwd: HERE, stdio: 'inherit' })
    const file = join(out, `video-${format}-${width}x${height}.mp4`)
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-map', '0:v:0', '-c', 'copy', '-an', '-movflags', '+faststart', `${file}.tmp.mp4`])
    renameSync(`${file}.tmp.mp4`, file)
    console.log(`  ${file}`)
  }
}
