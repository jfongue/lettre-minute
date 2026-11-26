# Passer à Supabase Realtime

Préparation, novembre 2026. Ce document dit ce qui bascule, dans quel ordre, et
ce qui peut casser. Rien n'a basculé : le client relève toujours à intervalle,
derrière une interface qui accueillera Realtime sans toucher aux écrans.

## Aujourd'hui

Le client n'embarque pas Realtime (`src/lib/supabase.ts` : `auth-js` et
`postgrest-js` seuls). Tout ce qui « arrive » se relève :

| Quoi | Où | Cadence | Nature |
| --- | --- | --- | --- |
| Table de duel en ligne | `src/state/duel.ts`, `duel_sync` | 450 ms en partie, 1 s au salon, 2,5 s au bilan | lecture du journal après `seq` |
| Invitations à une table | `src/App.tsx`, `duel_my_invites` | 15 s, à l'accueil | lecture |
| File du matchmaking | `src/ui/DuelScreen.tsx`, `duel_matchmake` | 2 s | **battement** : qui ne relit plus sort de la file au bout de 20 s (0072) |
| Défi suivi | `src/ui/ChallengeScreen.tsx` | `WATCH_MS`, tant qu'on attend les autres | lecture |
| Défis, amis | `src/App.tsx` | 60 s à l'accueil, et au retour au premier plan | lecture |
| Classements | `src/App.tsx` | 5 min | lecture (cache serveur, 0110) |
| Modération | `RequestsPage` | à l'ouverture | lecture + versement (`top_up_moderation`) |

Le coût réel est la table de duel : quatre appareils à 450 ms, c'est près de
neuf appels `duel_sync` par seconde et par table, dont l'immense majorité ne
rapporte rien.

## Ce qui bascule, ce qui reste

**Broadcast depuis la base, pour la table de duel et les invitations.** Chaque
écriture qui change ce que la table montre sonne sur un canal privé
(`duel:<table>`, `duel-invites:<joueur>`), et l'appareil réveillé relit
`duel_sync` ou `duel_my_invites` exactement comme aujourd'hui. Le message ne
porte rien que l'écran ne montre déjà (`{ seq }` pour un coup, `{}` sinon) :
c'est une sonnette, pas une donnée.

Pourquoi pas **Postgres Changes** : les quatre tables du duel n'ont aucune
politique et tout passe par les fonctions `duel_*` (0046). Postgres Changes ne
livre une ligne qu'à qui peut la lire en `select` : il faudrait ouvrir
`duel_moves`, `duel_seats` et `duel_invites` en lecture directe, avec ce que
cela expose (heure de dernière lecture de chacun, invitations de la table), et
vérifier la politique à chaque changement pour chaque abonné — le goulot connu
de Postgres Changes. Il faudrait aussi `replica identity full` pour lire les
suppressions. Broadcast n'a besoin de rien de tout cela.

Pourquoi pas **Presence** : le meneur se désigne par `duel_seats.last_seen`, que
chaque appareil lit identiquement dans `duel_sync` (`driverOf`, fonction pure).
Presence est une vue répliquée entre nœuds, qui converge mais pas au même
instant pour tous : deux appareils pourraient se croire meneurs. Le meneur
reste donc une affaire de serveur et d'heures.

**Reste au relevé** : le matchmaking (c'est un battement, pas une lecture : le
supprimer ferait sortir le joueur de la file ; tout au plus une sonnerie
`matched` plus tard, pour gagner jusqu'à 2 s), les défis, les amis, les
classements et la modération (cadences de la minute, gain nul). Et le relevé
**reste sous Realtime**, étiré en filet de sécurité : c'est lui qui rattrape un
message perdu, une coupure, une table expirée sans écriture (le quart d'heure
du salon) ou une absence qui ne se voit qu'au temps qui passe.

## Ce qui est en place

- **`src/lib/live.ts`** : `LiveTransport.watch(topic, wake, { every })`. Le seul
  transport est `pollingTransport`, le relevé d'avant à l'identique (même
  cadence, rien page cachée). `liveTransport()` est le point unique où le
  prochain patch choisira. `channelOf` nomme les canaux comme les déclencheurs
  SQL les nomment. Tests : `src/lib/live.test.ts` (horloge factice).
- **Branchés dessus** : la table de duel (`src/state/duel.ts`) et les invitations
  (`src/App.tsx`). Aucun changement de comportement : la première lecture reste
  faite par l'écran avant l'abonnement, le garde `syncing` de `sync` absorbe
  toujours les réveils en rafale.
- **`supabase/migrations/0121_duel_realtime.sql`, écrite, pas appliquée** :
  - `duel_ring(topic, event, payload)` appelle `realtime.send(…, private => true)`
    et avale toute erreur en avertissement — une sonnerie manquée coûte une
    lecture, un coup refusé coûterait la partie ;
  - déclencheurs **d'instruction** (tables de transition) : une sonnerie par
    instruction et par table, si bien que `duel_unstart` qui efface tout un
    journal sonne une fois ;
  - `last_seen` ne sonne jamais (sinon chaque lecture réveille la table, qui
    relit, qui réveille…), ni `queued_at` / `cancelled_at`, comptabilité des
    pushs (0060) ;
  - une table qui change de statut sonne aussi chez ses invités en attente ;
  - politique `duel_channels_listen` sur `realtime.messages` : entend
    `duel:<table>` qui a une place à cette table (la règle de `duel_sync`,
    expulsé compris : il doit l'apprendre), `duel-invites:<joueur>` le joueur
    lui-même ; aucune politique d'écriture, donc aucun client ne sonne ;
  - ni publication `supabase_realtime` ni `replica identity` : inutiles hors
    Postgres Changes.
- **Tests SQL** : `supabase/tests/48_duel_realtime.sql`, avec un `realtime` minimal
  dans `prelude.sql` (`messages`, `topic()`, `send()`, comme le projet les
  fournit). `scripts/test-db.sh realtime`.

## Les étapes

1. *(ce patch)* Interface, relevé seul, migration écrite.
2. **Appliquer 0121** (accord de Jérémy) : `supabase db push --linked`. Sans
   abonné, chaque écriture du duel ajoute une ligne à `realtime.messages`
   (partitionnée par jour, purgée par Realtime) : surveiller le volume la
   première semaine. Elle peut partir avant le client, et n'en dépend pas.
3. **Le transport Realtime**, derrière une fonctionnalité `realtime` de
   `FEATURES` (`supers` d'abord) :
   - `@supabase/realtime-js` à la même version que `auth-js` et `postgrest-js`,
     dans `src/lib/realtime.ts`, **importé dynamiquement** par `liveTransport()`
     seulement quand la fonctionnalité est ouverte, `supabase` non nul et le
     compte nommé — le premier bundle ne bouge pas, Reddit ne le voit jamais ;
   - une seule socket par appareil, ouverte au premier `watch`, fermée quelques
     secondes après le dernier ;
   - `realtime.setAuth(jeton)` à la connexion et à chaque `TOKEN_REFRESHED` de
     `auth.onAuthStateChange` : un canal privé se ferme quand son JWT expire ;
   - à chaque `SUBSCRIBED` (premier comme après reconnexion), un `wake()`
     immédiat : ce qui a sonné pendant la coupure est perdu ;
   - canal en erreur ou fermé → relevé à la cadence d'aujourd'hui jusqu'au
     prochain `SUBSCRIBED`. Le relevé n'est jamais retiré.
4. **La table de duel d'abord** : filet à 1 s en partie (au lieu de 450 ms),
   2,5 s au salon et au bilan — voir le risque « meneur » ci-dessous avant
   d'étirer davantage.
5. **Les invitations** : filet à 60 s au lieu de 15 s.
6. Ouvrir `realtime` à tout le monde après une semaine de super modérateurs et
   de modérateurs, en lisant les appels `duel_sync` par table et les plaintes
   de duel figé. Puis seulement, peut-être, la sonnerie `matched` du matchmaking.

## Risques

- **Le meneur dépend de la cadence de lecture.** `DRIVER_SILENCE` (4 s,
  `src/domain/duelLog.ts`) juge un joueur silencieux sur `seen`, que `duel_sync`
  ne rafraîchit qu'une fois toutes les 2 s au plus ; le serveur, lui, accepte
  le temps écoulé d'un absent après 8 s (0049). Un appareil qui ne relirait
  plus que toutes les 3 s aurait un `seen` vieux de 5 s par moments : la table
  le croirait parti, et le meneur changerait de main sans cesse. Le filet de
  partie doit donc rester sous ~1,5 s, ou bien un battement de présence léger
  (`duel_seen`, sans relecture) doit le remplacer. C'est la vraie limite du
  gain en partie ; au salon et à l'accueil, rien de tel.
- **RLS des canaux.** L'autorisation d'un canal privé se juge à l'abonnement,
  pas à chaque message : un joueur expulsé garde le canal jusqu'à sa
  déconnexion, ce qui est voulu (la règle de `duel_sync` est la même) et sans
  fuite, puisque le message ne porte rien. Le réglage du projet « Realtime :
  allow public access » peut rester tel quel : le client demande `private: true`.
- **Reconnexion.** Phoenix reconnecte avec un recul progressif ; entre-temps,
  le relevé tient. Tout `SUBSCRIBED` déclenche une lecture.
- **Android en arrière-plan.** La WebView gèle le JavaScript et le système
  coupe la socket. Au retour (`onAppActive`, `visibilitychange`), l'écran relit
  déjà de lui-même ; le transport doit aussi se réabonner. Hors de l'app, ce
  sont toujours les pushs (0060) qui préviennent d'une invitation.
- **CrazyGames, Playgama, Y8.** La page vit dans l'iframe du portail : la
  socket part vers `wss://<projet>.supabase.co/realtime/v1`. À vérifier au
  harnais et dans l'aperçu du portail (`crazygames:verify`) avant d'y ouvrir
  `realtime` ; la fonctionnalité peut se fermer par hôte (`closedFeatures`).
  L'invité sans compte n'a pas de canal (rôle `anon`) et ne joue de toute façon
  que la table des joueurs maison, locale.
- **Reddit.** Pas de Supabase : `liveTransport()` n'y est jamais appelé
  (pas de duel en ligne), et l'import dynamique, gardé par `supabase`, garde
  `realtime-js` hors du post — `check:platforms` le vérifiera.
- **Déterminisme du duel.** Inchangé : le transport ne porte aucune donnée, le
  journal ne vient que de `duel_sync`, ordonné par `seq`, et deux coups
  concurrents se départagent toujours par `stale`. Le décalage d'horloge reste
  estimé sur les allers-retours de `duel_sync`, simplement moins souvent.
- **Messages perdus ou doublés.** Une lecture de trop ou de moins, rien
  d'autre : la lecture est idempotente, et `mergeJournal` dédoublonne. Le
  `seq` de la sonnerie permet, si l'on veut, de sauter une lecture quand le
  journal le connaît déjà.
- **Charge et quotas.** Une connexion simultanée par appareil en duel ou à
  l'accueil, contre le plafond du plan Supabase ; chaque écriture du duel coûte
  un message par abonné. À comparer, en partie, aux neuf `duel_sync` par
  seconde et par table d'aujourd'hui.

## Poids

`@supabase/realtime-js` 2.117.0 avec `@supabase/phoenix` : **57,7 Ko minifiés,
17,1 Ko gzip** (esbuild, `RealtimeClient` seul). Pour comparaison, les scripts
que `index.html` charge d'entrée pèsent aujourd'hui environ 765 Ko minifiés,
225 Ko gzip : embarqué d'office, Realtime y ajouterait près de 8 %. Importé à la
demande, il ne se télécharge qu'à la première table en ligne ou au premier
passage à l'accueil d'un compte nommé dont la fonctionnalité est ouverte.

## À savoir pour un rebase

La passe de polissage (`claude/polish-pass`) touche aussi `src/state/duel.ts`
(mémo de `setup`, nettoyage d'`onAppActive`) : pas les mêmes lignes que l'effet
de relève remplacé ici, le rebase devrait être mécanique. Elle a été écrite 0119, puis renumérotée 0121 le 26 novembre 2026 : la
modération selon le stock avait pris 0119 et 0120 en ligne.
