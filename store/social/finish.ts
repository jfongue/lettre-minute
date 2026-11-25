// Closes the kit once the stills and the videos are in .cache/social-kit/kit:
// each language gets post.txt (the text to paste under a post), French gets
// the 30 s promo of store/promo too, and the folder gets its LISEZMOI.txt —
// the guide the person posting reads, in French, on the shared drive.
//
//   node store/social/finish.ts
import { copyFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import './copy.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../..')
const KIT = join(ROOT, '.cache/social-kit/kit')
const COPY = (globalThis as any).COPY as Record<string, { name: string[]; post: string; tags: string }>

for (const [lang, copy] of Object.entries(COPY)) {
  writeFileSync(join(KIT, lang, 'post.txt'), `${copy.name.join(' ')}\n\n${copy.post}\n\n${copy.tags}\n`)
}
copyFileSync(join(ROOT, 'store/promo/lettre-minute-promo.mp4'), join(KIT, 'fr/video-promo-30s-1080x1920.mp4'))

writeFileSync(join(KIT, 'LISEZMOI.txt'), `Lettre Minute — kit réseaux sociaux et stores
Généré le ${new Date().toISOString().slice(0, 10)} par store/social (dépôt lettre-minute).

Un dossier par langue (fr en de es it nl pt), chacun avec :

video-story-1080x1920.mp4      TikTok, Reels, Shorts, stories (9:16)
video-feed-1080x1350.mp4       fil Instagram / Facebook (4:5)
video-square-1080x1080.mp4     X, Reddit, Discord, Facebook (1:1)
video-landscape-1920x1080.mp4  YouTube, X, Discord, vidéo de la fiche Play (16:9)
  Environ 21 s, sans son : ajouter la musique dans l'app du réseau.
  fr/ a aussi video-promo-30s-1080x1920.mp4, la vidéo d'origine avec le son du jeu.

image-<format>-0.png à 6.png
  0  titre : icône, nom, accroche, « gratuit sur Android »
  1  une lettre, un thème, 60 secondes
  2  trouve le plus de mots possible
  3  défie tes amis
  4  des pouvoirs pour tricher un peu
  5  plein de thèmes à découvrir
  6  maîtrise le jeu
  Formats : square 1080×1080, feed 1080×1350 (carrousel Instagram),
  story 1080×1920 (texte sous la barre du haut), landscape 1920×1080,
  et image-banner-0.png 1500×500 (bannière de profil X).

post.txt
  Le texte à coller sous une publication, avec ses hashtags.

Le jeu se présente « sur Android » : jamais de lien ni de mention du web.
`)
console.log(`kit closed in ${KIT}`)
