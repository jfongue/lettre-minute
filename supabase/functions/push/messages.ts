/**
 * What a push says, in the language of the phone it goes to. Kept here rather
 * than in `src/i18n/`: the function runs on the server, apart from the game's
 * bundle. The wording follows `challenge.invitePop`, `challenge.overPop` and
 * `duel.inviteCard`.
 *
 * `duel_cancel` has no wording: it says nothing, it only takes a notification
 * back down (`sendSilent`, `fcm.ts`), and the phone's language is still the one
 * the invitation was written in.
 */

export type PushKind = 'invite' | 'recap' | 'duel' | 'duel_cancel' | 'match'
export type SpokenKind = Exclude<PushKind, 'duel_cancel'>

interface Wording {
  invite: (owner: string, players: number) => { title: string; body: string }
  recap: (owner: string) => { title: string; body: string }
  duel: (owner: string, players: number) => { title: string; body: string }
  /** The ranked queue found an opponent while the app was closed: a minute to come back. */
  match: (opponent: string) => { title: string; body: string }
}

const WORDING: Record<string, Wording> = {
  fr: {
    invite: (owner, players) => ({ title: `${owner} te défie !`, body: `${players} joueurs, les mêmes lettres pour tous. 24 h pour jouer.` }),
    recap: (owner) => ({ title: 'Défi terminé !', body: `Tout le monde a joué au défi de ${owner} : le bilan t’attend.` }),
    duel: (owner, players) => ({ title: `${owner} t’invite à un duel`, body: `${players} à la table. Rejoins-les tant qu’il reste une place.` }),
    match: (opponent) => ({ title: 'Adversaire trouvé !', body: `${opponent || 'Un joueur'} t’attend pour un duel classé. Une minute pour accepter.` }),
  },
  en: {
    invite: (owner, players) => ({ title: `${owner} challenges you!`, body: `${players} players, the same letters for all. 24 h to play.` }),
    recap: (owner) => ({ title: 'Challenge over!', body: `Everyone has played ${owner}’s challenge: the results are in.` }),
    duel: (owner, players) => ({ title: `${owner} invites you to a duel`, body: `${players} at the table. Join while there is room.` }),
    match: (opponent) => ({ title: 'Opponent found!', body: `${opponent || 'A player'} is waiting for a ranked duel. One minute to accept.` }),
  },
  es: {
    invite: (owner, players) => ({ title: `¡${owner} te reta!`, body: `${players} jugadores, las mismas letras para todos. 24 h para jugar.` }),
    recap: (owner) => ({ title: '¡Reto terminado!', body: `Todos han jugado el reto de ${owner}: los resultados te esperan.` }),
    duel: (owner, players) => ({ title: `${owner} te invita a un duelo`, body: `${players} en la mesa. Entra mientras quede sitio.` }),
    match: (opponent) => ({ title: '¡Rival encontrado!', body: `${opponent || 'Un jugador'} te espera para un duelo clasificatorio. Un minuto para aceptar.` }),
  },
  de: {
    invite: (owner, players) => ({ title: `${owner} fordert dich heraus!`, body: `${players} Spieler, dieselben Buchstaben für alle. 24 Std. zum Spielen.` }),
    recap: (owner) => ({ title: 'Duell beendet!', body: `Alle haben das Duell von ${owner} gespielt: das Ergebnis wartet.` }),
    duel: (owner, players) => ({ title: `${owner} lädt dich zu einem Duell ein`, body: `${players} am Tisch. Komm dazu, solange Platz ist.` }),
    match: (opponent) => ({ title: 'Gegner gefunden!', body: `${opponent || 'Ein Spieler'} wartet auf ein gewertetes Duell. Eine Minute zum Annehmen.` }),
  },
  it: {
    invite: (owner, players) => ({ title: `${owner} ti sfida!`, body: `${players} giocatori, le stesse lettere per tutti. 24 h per giocare.` }),
    recap: (owner) => ({ title: 'Sfida finita!', body: `Tutti hanno giocato la sfida di ${owner}: i risultati ti aspettano.` }),
    duel: (owner, players) => ({ title: `${owner} ti invita a un duello`, body: `${players} al tavolo. Entra finché c’è posto.` }),
    match: (opponent) => ({ title: 'Avversario trovato!', body: `${opponent || 'Un giocatore'} ti aspetta per un duello classificato. Un minuto per accettare.` }),
  },
  nl: {
    invite: (owner, players) => ({ title: `${owner} daagt je uit!`, body: `${players} spelers, dezelfde letters voor iedereen. 24 u om te spelen.` }),
    recap: (owner) => ({ title: 'Uitdaging afgelopen!', body: `Iedereen heeft de uitdaging van ${owner} gespeeld: de uitslag wacht.` }),
    duel: (owner, players) => ({ title: `${owner} nodigt je uit voor een duel`, body: `${players} aan tafel. Kom erbij zolang er plaats is.` }),
    match: (opponent) => ({ title: 'Tegenstander gevonden!', body: `${opponent || 'Een speler'} wacht op een ranked duel. Eén minuut om te accepteren.` }),
  },
  pt: {
    invite: (owner, players) => ({ title: `${owner} desafia-te!`, body: `${players} jogadores, as mesmas letras para todos. 24 h para jogar.` }),
    recap: (owner) => ({ title: 'Desafio terminado!', body: `Todos jogaram o desafio de ${owner}: os resultados esperam-te.` }),
    duel: (owner, players) => ({ title: `${owner} convida-te para um duelo`, body: `${players} à mesa. Entra enquanto há lugar.` }),
    match: (opponent) => ({ title: 'Adversário encontrado!', body: `${opponent || 'Um jogador'} espera-te para um duelo ranqueado. Um minuto para aceitar.` }),
  },
}

export function pushText(kind: SpokenKind, lang: string, owner: string, players: number): { title: string; body: string } {
  const wording = WORDING[lang] ?? WORDING.fr!
  if (kind === 'invite') return wording.invite(owner, players)
  if (kind === 'duel') return wording.duel(owner, players)
  if (kind === 'match') return wording.match(owner)
  return wording.recap(owner)
}
