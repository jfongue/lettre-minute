import { describe, expect, it } from 'vitest'
import { designUnlock, type Milestone } from './avatar'

/**
 * Les 43 tuiles livrées, jalon par jalon, tels qu'ils étaient avant l'ajout des
 * sept tuiles des mots ajoutés. Le commentaire de `LOOKS` promet qu'un
 * identifiant ne bouge pas, et les seuils sont ce qui décide de ce que chaque
 * joueur possède : `interleave` répartit les pistes par position, donc une piste
 * de plus décale tout ce qui suit — ce que la première version de cette liste a
 * fait, en donnant à la tuile 10 (soleil) le jalon du tout premier mot ajouté.
 * Un jalon déplacé redistribue les déblocages de tout le monde, y compris vers
 * le bas. C'est ce test qui doit le refuser.
 */
const SHIPPED: readonly string[] = [
  'aucun',
  'aucun',
  'aucun',
  'aucun',
  'aucun',
  'level:4',
  'runs:3',
  'wordsFound:100',
  'bestScore:400',
  'bestCombo:10',
  'level:6',
  'runs:5',
  'wordsFound:250',
  'bestScore:500',
  'bestCombo:13',
  'level:8',
  'runs:7',
  'wordsFound:500',
  'bestScore:600',
  'bestCombo:16',
  'level:10',
  'runs:10',
  'wordsFound:1000',
  'bestScore:700',
  'bestCombo:20',
  'level:13',
  'runs:25',
  'wordsFound:2000',
  'bestScore:800',
  'bestCombo:24',
  'level:16',
  'runs:50',
  'wordsFound:3500',
  'bestScore:900',
  'bestCombo:28',
  'level:20',
  'runs:100',
  'wordsFound:5000',
  'level:25',
  'runs:200',
  'level:30',
  'runs:400',
  'level:35',
]

const label = (goal: Milestone | null) => (goal ? `${goal.stat}:${goal.at}` : 'aucun')

describe('les jalons d’avatar déjà livrés', () => {
  it('ne bougent pas quand on ajoute des tuiles', () => {
    const now = SHIPPED.map((_, index) => label(designUnlock(index)))

    expect(now).toEqual(SHIPPED)
  })

  // Les sept tuiles des mots ajoutés : leur jalon est le seul que cette liste
  // introduit, il vient après les 43 autres et suit les seuils demandés.
  it('laissent les sept derniers jalons aux mots ajoutés, dans l’ordre', () => {
    const added = Array.from({ length: 7 }, (_, index) => designUnlock(43 + index))

    expect(added.map(label)).toEqual([
      'wordsAdded:1',
      'wordsAdded:15',
      'wordsAdded:50',
      'wordsAdded:100',
      'wordsAdded:300',
      'wordsAdded:500',
      'wordsAdded:1000',
    ])
  })
})
