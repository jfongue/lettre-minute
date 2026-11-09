# Update notes for CrazyGames review

This build is 1.7.0 (the portal has 1.6.1). Every point below is a change since
that build, and each was played in the portal's frames (926×476, 800×450,
1280×720, 390×844) with `npm run crazygames:check`.

## Ads

- The midgame ad is requested only by a button that leads to gameplay: Play on
  the powers screen, or Play / Play again when that screen is off, and the
  start of a friends' challenge. Nothing is requested after the word recap any
  more, and there is no timer of ours: the SDK paces its ads.
- On the duel's results screen the ad is requested by "Rematch" and "Leave the
  table", never by the result itself.
- Never for a Premium player.

## Gameplay signals

- `gameplayStart` now follows the real start of the run: when the clock runs
  and during the first lesson, never on the "Coming up" countdown that only
  announces the categories.
- The duel table reports its own gameplay start and stop: a played hand, not
  the lobby, the rules, the draft or the result, and leaving the table stops
  it.

## Multiplayer

- The table the player sits at is a CrazyGames room (`updateRoom`), joinable
  while its lobby has a free seat and left with the screen; a rematch becomes
  the next room.
- A friend who accepts the portal's invitation lands at that table, at launch
  or while the game runs, and sits down without an invitation of the game's
  own; a guest is offered the portal's sign-in first, and the invitation
  survives its reload.
- A launch in instant multiplayer opens a private table at once instead of the
  first lesson, and a matchmaking table opens straight on the draft with no
  lobby or announcement.
- The rematch lobby shows only the players who played, with no free seat and
  no invite list, and a duel no longer freezes on its opening countdown.

## The frame

- The scrollbar is never drawn any more, on any screen: content still scrolls
  (the leaderboard's rows, the home's right column), it just shows no bar.
- Every scene fits the frame: the powers' choice and "Play with friends" go
  two columns in landscape, the home's column scrolls without moving the
  poster and title, and the end-of-run score stays centred when the hidden
  words unfold.
- At 640×360 the powers' screen still shows its slots, its powers and its Play
  button without scrolling.

## Accounts and progress

- A player who signs out of the portal no longer finds the account's progress
  on the guest: the game account is read only once the portal's own has been
  followed.
- The home leaderboard no longer leaves a blank under the shorter board.
