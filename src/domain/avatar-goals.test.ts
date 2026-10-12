import { describe, expect, it } from 'vitest'
import { designGoal, type Goal } from './achievements'

/**
 * Les 53 tuiles, jalon par jalon, telles qu'elles sont livrées. Le commentaire
 * de `LOOKS` promet qu'un identifiant ne bouge pas, et les seuils décident de
 * ce que chaque joueur possède : les barreaux de la grille se répartissent par
 * position, donc une piste de plus ou un seuil déplacé redistribue les
 * déblocages de tout le monde, y compris vers le bas. C'est ce test qui doit
 * le refuser.
 *
 * Réécrit une fois, exprès : les seuils ont été retaillés sur ce que les
 * joueurs font vraiment (`docs/achievements-thresholds.md`), et les pistes du
 * défi du moment, des défis entre amis, de la modération, des mots courts
 * d'affilée et de la suite sans passer ont pris leurs cases. Toute autre
 * modification se refuse ici.
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
  'level:7',
  'bestCombo:10',
  'wordsAdded:5',
  'wordsFound:300',
  'wordsReviewed:50',
  'bestCombo:15',
  'weeklyAttempts:5',
  'challengesFinished:5',
  'bestScore:350',
  'shortStreak:10',
  'wordsFound:600',
  'bestScore:450',
  'level:10',
  'runs:10',
  'wordsFound:1000',
  'bestCombo:20',
  'weeklyAttempts:30',
  'bestScore:550',
  'challengesFinished:25',
  'wordsFound:2000',
  'wordsReviewed:150',
  'bestCombo:24',
  'level:14',
  'runs:30',
  'wordsFound:4000',
  'wordsReviewed:300',
  'bestScore:750',
  'level:20',
  'runs:100',
  'runs:250',
  'level:27',
  'bestScore:900',
  'wordsFound:8000',
  'runs:400',
  'level:35',
  'bestCombo:30',
  'wordsAdded:10',
  'wordsAdded:40',
  'wordsAdded:150',
  'wordsAdded:500',
  'level:50',
  'runs:1200',
  'bestScore:666',
  'wordsReviewed:10',
  'noPassStreak:50',
]

const label = (goal: Goal | null) => (goal ? `${goal.stat}:${goal.at}` : 'aucun')

describe('les jalons d’avatar livrés', () => {
  it('ne bougent plus', () => {
    const now = SHIPPED.map((_, index) => label(designGoal(index)))

    expect(now).toEqual(SHIPPED)
  })
})
