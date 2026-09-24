/**
 * What a push says, in the language of the phone it goes to. Kept here rather
 * than in `src/i18n/`: the function runs on the server, apart from the game's
 * bundle. The wording follows `challenge.invitePop` and `challenge.overPop`.
 */

export type PushKind = 'invite' | 'recap'

interface Wording {
  invite: (owner: string, players: number) => { title: string; body: string }
  recap: (owner: string) => { title: string; body: string }
}

const WORDING: Record<string, Wording> = {
  fr: {
    invite: (owner, players) => ({ title: `${owner} te défie !`, body: `${players} joueurs, les mêmes lettres pour tous. 24 h pour jouer.` }),
    recap: (owner) => ({ title: 'Défi terminé !', body: `Tout le monde a joué au défi de ${owner} : le bilan t’attend.` }),
  },
  en: {
    invite: (owner, players) => ({ title: `${owner} challenges you!`, body: `${players} players, the same letters for all. 24 h to play.` }),
    recap: (owner) => ({ title: 'Challenge over!', body: `Everyone has played ${owner}’s challenge: the results are in.` }),
  },
  es: {
    invite: (owner, players) => ({ title: `¡${owner} te reta!`, body: `${players} jugadores, las mismas letras para todos. 24 h para jugar.` }),
    recap: (owner) => ({ title: '¡Reto terminado!', body: `Todos han jugado el reto de ${owner}: los resultados te esperan.` }),
  },
  de: {
    invite: (owner, players) => ({ title: `${owner} fordert dich heraus!`, body: `${players} Spieler, dieselben Buchstaben für alle. 24 Std. zum Spielen.` }),
    recap: (owner) => ({ title: 'Duell beendet!', body: `Alle haben das Duell von ${owner} gespielt: das Ergebnis wartet.` }),
  },
  it: {
    invite: (owner, players) => ({ title: `${owner} ti sfida!`, body: `${players} giocatori, le stesse lettere per tutti. 24 h per giocare.` }),
    recap: (owner) => ({ title: 'Sfida finita!', body: `Tutti hanno giocato la sfida di ${owner}: i risultati ti aspettano.` }),
  },
  nl: {
    invite: (owner, players) => ({ title: `${owner} daagt je uit!`, body: `${players} spelers, dezelfde letters voor iedereen. 24 u om te spelen.` }),
    recap: (owner) => ({ title: 'Uitdaging afgelopen!', body: `Iedereen heeft de uitdaging van ${owner} gespeeld: de uitslag wacht.` }),
  },
  pt: {
    invite: (owner, players) => ({ title: `${owner} desafia-te!`, body: `${players} jogadores, as mesmas letras para todos. 24 h para jogar.` }),
    recap: (owner) => ({ title: 'Desafio terminado!', body: `Todos jogaram o desafio de ${owner}: os resultados esperam-te.` }),
  },
}

export function pushText(kind: PushKind, lang: string, owner: string, players: number): { title: string; body: string } {
  const wording = WORDING[lang] ?? WORDING.fr!
  return kind === 'invite' ? wording.invite(owner, players) : wording.recap(owner)
}
