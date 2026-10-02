// The promo's sound score, laid on the clips from the takes' gesture logs
// (../capture/drive.sh), then rendered by the game's sound module: node render.mjs
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const puppeteer = createRequire(new URL('../video/', import.meta.url))('puppeteer-core')

const log = (take) => readFileSync(`../takes/${take}.log`, 'utf8').trim().split('\n').map((line) => { const [t, kind, arg] = line.split(' '); return { t: Number(t), kind, arg } })
// Each clip: where it sits in the promo, which stretch of its take, how fast.
const clip = (at, from, to, speed) => ({ map: (s) => at + (s - from) / speed, has: (s) => s >= from && s <= to })
const A = clip(2.8, 2.0, 7.2, 2), B = clip(5.4, 7.0, 23.0, 2), C = clip(13.4, 18.9, 24.3, 1.5)
const D = clip(19.5, 67.2, 75.2, 2), F = clip(23.5, 3.9, 9.5, 1.6)
const q = []

q.push([0, 'music', 'menu'])
;['wood', 'marimba', 'wood', 'marimba', 'glass', 'marimba', 'marimba', 'glass', 'marimba', 'marimba'].forEach((tb, i) => q.push([0.05 + i * 0.05, 'tile', tb, i, 0]))
q.push([0.95, 'go'], [1.15, 'click'], [2.3, 'music', null], [2.35, 'skipped'])

// Announcement and 3-2-1 of the take without powers (read on its footage).
;['couleurs', 'objets', 'pays', 'prenoms', 'plantes'].forEach((id, i) => q.push([A.map(2.5), 'category', id, i, 0.075 + i * 0.1]))
;[4.46, 5.26, 6.06].forEach((s) => q.push([A.map(s), 'beat']))
q.push([A.map(6.86), 'go'], [A.map(6.86), 'music', 'pulse'], [A.map(6.86), 'stage', 0])

// Typing: each letter, each correction, the word named on its last letter, then validated.
function typing(events, c, tiers, firstStep) {
  let word = 0
  events.forEach((e, i) => {
    if (!c.has(e.t)) { if (e.kind === 'enter') word++; return }
    if (e.kind === 'key') {
      q.push([c.map(e.t), 'key'])
      if (events[i + 1]?.kind === 'enter') q.push([c.map(e.t) + 0.04, 'recognized'])
    }
    if (e.kind === 'back') q.push([c.map(e.t), 'key', true])
    if (e.kind === 'cast') q.push([c.map(e.t) + 0.05, 'power', 'joker'], [c.map(e.t) + 0.15, 'recognized'])
    if (e.kind === 'enter') { q.push([c.map(e.t) + 0.05, 'found', tiers[word] ?? 0, firstStep + word]); word++ }
  })
}
typing(log('none'), B, [2, 0, 1, 1, 0], 0)
typing(log('joker').filter((e) => e.kind !== 'fast'), C, Array(12).fill(0), 0)
q.push([5.2, 'click'], [13.2, 'click'], [13.4, 'stage', 0])

q.push([16.8, 'click'], [17.0, 'music', 'menu'], [17.05, 'power', 'joker'], [19.3, 'click'], [D.map(66.9), 'timeUp'])
;[[69.25, 2], [69.95, 0], [70.45, 1], [70.9, 1], [71.4, 0]].forEach(([s, tier], i) => q.push([D.map(s), 'recap', tier, i]))

q.push([23.3, 'click'])
for (const vote of log('moder')) {
  if (!F.has(vote.t)) continue
  q.push([F.map(vote.t), 'recognized'], vote.arg === 'right' ? [F.map(vote.t) + 0.08, 'found', 3, 4] : [F.map(vote.t) + 0.08, 'skipped'])
}

q.push([26.62, 'skipped'])
;['wood', 'marimba', 'wood', 'marimba', 'glass'].forEach((tb, i) => q.push([27.05 + i * 0.05, 'tile', tb, i + 2, 0]))
q.push([27.75, 'levelUp'], [29.5, 'music', null])

execSync("npx --prefix ../video esbuild sfx.ts --bundle --format=iife --define:import.meta.env='{}' --outfile=.sfx.js --log-level=error")
writeFileSync('.sfx.html', '<!doctype html><script src=".sfx.js"></script>')
const chrome = execSync('npx --prefix ../video hyperframes browser path').toString().trim().split('\n').pop()
const browser = await puppeteer.launch({ executablePath: chrome, headless: true })
const page = await browser.newPage()
page.on('pageerror', (e) => console.log('pageerror:', e.message))
await page.goto(`file://${process.cwd()}/.sfx.html`)
writeFileSync('../video/assets/sfx.wav', Buffer.from(await page.evaluate((score) => window.renderPromo(score), q), 'base64'))
await browser.close()
console.log(`${q.length} cues -> video/assets/sfx.wav`)
