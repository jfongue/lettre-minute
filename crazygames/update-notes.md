# Update notes for CrazyGames review

This build is 1.7.2 (the portal has 1.6.1; 1.7.0 and 1.7.1 were reviewed and sent back). Every point below is a change since
that build, and each was played in the portal's frames (926×476, 800×450,
1280×720, 390×844) with `npm run crazygames:check`.

## Answers to the review of 1.7.1

- **"Coming up" cut on the left.** The list of categories was 5 px wider than
  its sheet and the sheet clips (so the countdown never shows a bar): both now
  share the sheet's width, and the « C » is whole.
- **Multiplayer screen.** The staggered layout came from a build older than
  the fix the review approved: the title and text on the left, the three cards
  stacked on the right. The two groups are now real boxes, so the cards cannot
  fall into the left column again.
- **A bar appearing for a moment.** Two entrance animations pushed the home
  sheet past its edge for a few frames (the duel invitation card's spring and
  the leaderboard's swap): they now settle inside it. Boxes that really scroll
  keep their bar.
- **"Back to the lobby" during my pick.** Disabled while it is my turn to pick
  a category.
- **Rematch stuck on "Opening the table…" after a matchmaking duel.** Each
  player now declares ready on the rematch table as on the first one, so the
  draft opens once both agreed.
- **Invite button active on that screen.** A rematch table and a matchmaking
  table are never reported as joinable rooms, and the rematch lobby shows no
  free seat.

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

## Answers to the latest review

- **Home leaderboard (blank under the board).** The carousel's height follows
  the board on screen; `npm run crazygames:flows` now measures it at 478×510
  and 390×844 on Day and Week, so a later build cannot bring the blank back.
- **Signing out.** A signed-out player is always a new guest. Two causes were
  found and fixed: a browser whose first start was already signed in never
  armed the previous guard, and since the SDK swaps its Data module on a
  sign-in without reloading the page, the game kept writing the account's
  progress into the guest's local save. The browser now remembers whose
  progress it holds; a start as a guest after an account erases the account's
  progress, its caches and its session. A QA browser that held an account's
  save under an earlier build is reset once. Language, theme, sound and the
  lessons already seen stay with the device.
- **gameplayStart.** Never while the categories are picked nor on the opening
  countdown of a duel, never on « Coming up »: it is sent when the answer
  field is live. The same script plays a solo run and a duel against the
  house players and reads the SDK's log.
- **Scrollbars.** Every box that scrolls draws a bar (the challenge of the
  moment, its ranking, the leaderboards, the end-of-run panes, the menu…);
  the page-turning carousels keep their tabs and dots instead.

## The frame

- Every scene is walked in nine frames (640×360 to 1920×1080, plus 478×510
  and 390×844) in English, French and German by `npm run crazygames:sweep`:
  nothing wider or taller than its frame, no button cut by a box that does not
  scroll, no box scrolling without a bar, no word broken in the middle.
- Fixed on the way: the language picker cut on the right at 640 px, the title
  over the poster at 640×360, labels and card titles broken mid-word in small
  frames, the run's buttons off the edge in German on a phone-wide frame.
- The powers' choice and "Play with friends" go two columns in landscape, the
  home's column scrolls without moving the poster and title, and the
  end-of-run score stays centred when the hidden words unfold.

## Accounts and progress

- The home leaderboard no longer leaves a blank under the shorter board.
