/**
 * Builds the ZIP the Play Console imports under Play Games › Réussites ›
 * Importer : the fifteen achievements of src/domain/achievements.ts, their
 * names in seven languages and the icons `npm run render:achievements` drew.
 *
 *   npm run render:achievements && npx tsx scripts/play-games-achievements.ts
 *
 * Writes store/android/play-games/achievements.zip. The game project's default
 * language is en-US: English goes in the metadata, the others in the
 * localizations. No field may hold a comma — the CSVs have no quoting.
 * Achievement ids after the command keep only those: the Console imports new
 * achievements, it never updates the ones it already has.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, copyFileSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { ACHIEVEMENTS, type AchievementId } from '../src/domain/achievements.ts'

type Text = [name: string, description: string]
const LOCALES = ['en-US', 'fr-FR', 'de-DE', 'es-ES', 'it-IT', 'nl-NL', 'pt-BR'] as const

const TEXTS: Record<AchievementId, Record<(typeof LOCALES)[number], Text>> = {
  'level-4': {
    'en-US': ['First steps', 'Reach level 4'],
    'fr-FR': ['Premiers pas', 'Atteins le niveau 4'],
    'de-DE': ['Erste Schritte', 'Erreiche Level 4'],
    'es-ES': ['Primeros pasos', 'Alcanza el nivel 4'],
    'it-IT': ['Primi passi', 'Raggiungi il livello 4'],
    'nl-NL': ['Eerste stappen', 'Bereik level 4'],
    'pt-BR': ['Primeiros passos', 'Chegue ao nível 4'],
  },
  'runs-10': {
    'en-US': ['Ten minutes', 'Play 10 games'],
    'fr-FR': ['Dix minutes', 'Joue 10 parties'],
    'de-DE': ['Zehn Minuten', 'Spiele 10 Runden'],
    'es-ES': ['Diez minutos', 'Juega 10 partidas'],
    'it-IT': ['Dieci minuti', 'Gioca 10 partite'],
    'nl-NL': ['Tien minuten', 'Speel 10 potjes'],
    'pt-BR': ['Dez minutos', 'Jogue 10 partidas'],
  },
  'words-100': {
    'en-US': ['A hundred words', 'Find 100 words'],
    'fr-FR': ['Cent mots', 'Trouve 100 mots'],
    'de-DE': ['Hundert Wörter', 'Finde 100 Wörter'],
    'es-ES': ['Cien palabras', 'Encuentra 100 palabras'],
    'it-IT': ['Cento parole', 'Trova 100 parole'],
    'nl-NL': ['Honderd woorden', 'Vind 100 woorden'],
    'pt-BR': ['Cem palavras', 'Encontre 100 palavras'],
  },
  'combo-10': {
    'en-US': ['On a roll', 'Chain 10 answers in a row'],
    'fr-FR': ['En série', 'Enchaîne 10 réponses d’affilée'],
    'de-DE': ['Am Laufen', 'Gib 10 Antworten in Folge'],
    'es-ES': ['En racha', 'Encadena 10 respuestas seguidas'],
    'it-IT': ['In serie', 'Inanella 10 risposte di fila'],
    'nl-NL': ['Op dreef', 'Geef 10 antwoorden op rij'],
    'pt-BR': ['Em sequência', 'Emende 10 respostas seguidas'],
  },
  'discoveries-15': {
    'en-US': ['Explorer', 'Be the first in a week to write 15 words'],
    'fr-FR': ['Explorateur', 'Sois le premier de la semaine à écrire 15 mots'],
    'de-DE': ['Entdecker', 'Schreib als Erster der Woche 15 Wörter'],
    'es-ES': ['Explorador', 'Sé el primero de la semana en escribir 15 palabras'],
    'it-IT': ['Esploratore', 'Sii il primo della settimana a scrivere 15 parole'],
    'nl-NL': ['Ontdekker', 'Schrijf als eerste van de week 15 woorden'],
    'pt-BR': ['Explorador', 'Seja o primeiro da semana a escrever 15 palavras'],
  },
  'added-10': {
    'en-US': ['In the dictionary', 'Get 10 words of yours into the game’s dictionary'],
    'fr-FR': ['Au dictionnaire', 'Fais entrer 10 mots dans le dictionnaire du jeu'],
    'de-DE': ['Im Wörterbuch', 'Bring 10 Wörter ins Wörterbuch des Spiels'],
    'es-ES': ['En el diccionario', 'Haz entrar 10 palabras en el diccionario del juego'],
    'it-IT': ['Nel dizionario', 'Fai entrare 10 parole nel dizionario del gioco'],
    'nl-NL': ['In het woordenboek', 'Krijg 10 woorden in het woordenboek van het spel'],
    'pt-BR': ['No dicionário', 'Coloque 10 palavras no dicionário do jogo'],
  },
  'level-10': {
    'en-US': ['Regular', 'Reach level 10'],
    'fr-FR': ['Habitué', 'Atteins le niveau 10'],
    'de-DE': ['Stammgast', 'Erreiche Level 10'],
    'es-ES': ['Habitual', 'Alcanza el nivel 10'],
    'it-IT': ['Habitué', 'Raggiungi il livello 10'],
    'nl-NL': ['Vaste gast', 'Bereik level 10'],
    'pt-BR': ['Frequentador', 'Chegue ao nível 10'],
  },
  'runs-100': {
    'en-US': ['A hundred games', 'Play 100 games'],
    'fr-FR': ['Cent parties', 'Joue 100 parties'],
    'de-DE': ['Hundert Runden', 'Spiele 100 Runden'],
    'es-ES': ['Cien partidas', 'Juega 100 partidas'],
    'it-IT': ['Cento partite', 'Gioca 100 partite'],
    'nl-NL': ['Honderd potjes', 'Speel 100 potjes'],
    'pt-BR': ['Cem partidas', 'Jogue 100 partidas'],
  },
  'words-1000': {
    'en-US': ['A thousand words', 'Find 1000 words'],
    'fr-FR': ['Mille mots', 'Trouve 1000 mots'],
    'de-DE': ['Tausend Wörter', 'Finde 1000 Wörter'],
    'es-ES': ['Mil palabras', 'Encuentra 1000 palabras'],
    'it-IT': ['Mille parole', 'Trova 1000 parole'],
    'nl-NL': ['Duizend woorden', 'Vind 1000 woorden'],
    'pt-BR': ['Mil palavras', 'Encontre 1000 palavras'],
  },
  'level-20': {
    'en-US': ['Old hand', 'Reach level 20'],
    'fr-FR': ['Vieux routier', 'Atteins le niveau 20'],
    'de-DE': ['Alter Hase', 'Erreiche Level 20'],
    'es-ES': ['Veterano', 'Alcanza el nivel 20'],
    'it-IT': ['Veterano', 'Raggiungi il livello 20'],
    'nl-NL': ['Ouwe rot', 'Bereik level 20'],
    'pt-BR': ['Veterano', 'Chegue ao nível 20'],
  },
  'combo-24': {
    'en-US': ['Unstoppable', 'Chain 24 answers in a row'],
    'fr-FR': ['Inarrêtable', 'Enchaîne 24 réponses d’affilée'],
    'de-DE': ['Unaufhaltsam', 'Gib 24 Antworten in Folge'],
    'es-ES': ['Imparable', 'Encadena 24 respuestas seguidas'],
    'it-IT': ['Inarrestabile', 'Inanella 24 risposte di fila'],
    'nl-NL': ['Niet te stoppen', 'Geef 24 antwoorden op rij'],
    'pt-BR': ['Imparável', 'Emende 24 respostas seguidas'],
  },
  'score-900': {
    'en-US': ['Nine hundred', 'Score 900 points in one game'],
    'fr-FR': ['Neuf cents', 'Marque 900 points en une partie'],
    'de-DE': ['Neunhundert', 'Erziele 900 Punkte in einer Runde'],
    'es-ES': ['Novecientos', 'Consigue 900 puntos en una partida'],
    'it-IT': ['Novecento', 'Fai 900 punti in una partita'],
    'nl-NL': ['Negenhonderd', 'Scoor 900 punten in één potje'],
    'pt-BR': ['Novecentos', 'Marque 900 pontos em uma partida'],
  },
  'runs-400': {
    'en-US': ['Tireless', 'Play 400 games'],
    'fr-FR': ['Inépuisable', 'Joue 400 parties'],
    'de-DE': ['Unermüdlich', 'Spiele 400 Runden'],
    'es-ES': ['Incansable', 'Juega 400 partidas'],
    'it-IT': ['Instancabile', 'Gioca 400 partite'],
    'nl-NL': ['Onvermoeibaar', 'Speel 400 potjes'],
    'pt-BR': ['Incansável', 'Jogue 400 partidas'],
  },
  'words-5000': {
    'en-US': ['Walking dictionary', 'Find 5000 words'],
    'fr-FR': ['Dictionnaire vivant', 'Trouve 5000 mots'],
    'de-DE': ['Wandelndes Wörterbuch', 'Finde 5000 Wörter'],
    'es-ES': ['Diccionario andante', 'Encuentra 5000 palabras'],
    'it-IT': ['Dizionario vivente', 'Trova 5000 parole'],
    'nl-NL': ['Wandelend woordenboek', 'Vind 5000 woorden'],
    'pt-BR': ['Dicionário ambulante', 'Encontre 5000 palavras'],
  },
  'level-35': {
    'en-US': ['Master of the minute', 'Reach level 35'],
    'fr-FR': ['Maître de la minute', 'Atteins le niveau 35'],
    'de-DE': ['Meister der Minute', 'Erreiche Level 35'],
    'es-ES': ['Maestro del minuto', 'Alcanza el nivel 35'],
    'it-IT': ['Maestro del minuto', 'Raggiungi il livello 35'],
    'nl-NL': ['Meester van de minuut', 'Bereik level 35'],
    'pt-BR': ['Mestre do minuto', 'Chegue ao nível 35'],
  },
}

const OUT = 'store/android/play-games'
const only = process.argv.slice(2)
const chosen = ACHIEVEMENTS.filter((achievement) => only.length === 0 || only.includes(achievement.id))
const lines = (rows: string[][]) => rows.map((row) => row.join(',')).join('\n') + '\n'
for (const text of Object.values(TEXTS).flatMap((byLocale) => Object.values(byLocale).flat())) {
  if (text.includes(',')) throw new Error(`Virgule interdite : ${text}`)
}

const dir = mkdtempSync(join(tmpdir(), 'play-games-'))
const english = (id: AchievementId) => TEXTS[id]['en-US']
writeFileSync(
  join(dir, 'AchievementsMetadata.csv'),
  lines(chosen.map((achievement) => [...english(achievement.id), 'False', '', 'Revealed', String(achievement.points), String(ACHIEVEMENTS.indexOf(achievement) + 1)])),
)
writeFileSync(
  join(dir, 'AchievementsLocalizations.csv'),
  lines(
    chosen.flatMap((achievement) =>
      LOCALES.filter((locale) => locale !== 'en-US').map((locale) => [english(achievement.id)[0], ...TEXTS[achievement.id][locale], locale]),
    ),
  ),
)
writeFileSync(join(dir, 'AchievementsIconsMappings.csv'), lines(chosen.map((achievement) => [english(achievement.id)[0], `${achievement.id}.png`])))
for (const achievement of chosen) {
  const icon = `${OUT}/${achievement.id}.png`
  if (!existsSync(icon)) throw new Error(`Icône manquante : ${icon} — npm run render:achievements`)
  copyFileSync(icon, join(dir, `${achievement.id}.png`))
}
const zip = resolve(`${OUT}/achievements.zip`)
rmSync(zip, { force: true })
execFileSync('zip', ['-q', '-j', zip, ...['AchievementsMetadata.csv', 'AchievementsLocalizations.csv', 'AchievementsIconsMappings.csv', ...chosen.map((a) => `${a.id}.png`)].map((file) => join(dir, file))])
console.log(zip)
