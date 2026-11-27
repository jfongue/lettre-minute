# Update notes for CrazyGames review

## 1.7.8

Sent for review on 25 November 2026, replacing 1.7.7 in the queue. 1.7.8 is
1.7.7 with the following.

- **No run is lost to an expired session any more.** A signed-in player whose
  session expired while the tab slept had their calls refused by our server
  until the page was reloaded, and their runs lost. The session is now
  renewed, and a run it could not send waits on the device and leaves when
  the player comes back to the game.
- **The clock holds under any portal ad.** A full-screen ad can no longer
  play over a running run with its clock ticking.
- **Word moderation for signed-in players.** Moderators read the reasons left
  by earlier judges and can always refuse with one, proposals have a daily
  cap that follows each player's acceptance rate, and words flagged by
  moderators leave the dictionaries.

QA run in the portal's preview: one full run, gameplayStart and gameplayStop
60 s apart, a midgame ad requested from « Play » (adError with test ads, the
run started normally), no warning.

## 1.7.7

Sent for review on 25 November 2026, after 1.7.6 was sent back for a
leaderboard missing from the home. 1.7.7 is 1.7.6 with the following.

- **The leaderboard always shows on the home.** In 1.7.6 a signed-in player
  whose first launch met a server that did not answer saw no leaderboard at
  all, as in the review's screenshot. The home now shows the last board it
  read for the current day or week, and on a first launch, the player's own
  runs, as it already did for guests. The leaderboards page keeps its last
  boards the same way.
- **The leaderboard opens on the week** when nobody has played yet today.
- **A taller leaderboard in landscape.** Profile, Statistics, Requests and
  Categories now sit under « Multiplayer » in the left column, so the
  leaderboard runs down to the frame's bottom. In a low frame, the challenge
  of the moment takes a single line and the board's period caption goes, so
  the board shows a row more (854 × 410: three rows instead of two).

## 1.7.6

1.7.6 is 1.7.5 with the following.

- **No run is lost to a busy server any more.** A signed-in player's run that
  our server could not take (it was overloaded on 23 and 24 November) is kept
  on the device and sent again with the next run or at the next launch, dated
  when it was played. Runs lost during those outages are sent once from the
  device's own history.
- **The leaderboard climb at the end of a run always shows.** It is drawn from
  the board read when the run started, with the new score placed where it
  ranks, instead of waiting for the server; the home keeps showing today's
  last board when the server does not answer, instead of none.
- **Rewarded ads pay three reveals each**, with no daily cap.

## 1.7.5

1.7.5 is 1.7.4 with the following.

- **New categories.** Birds and reptiles, Sea animals, Clothes and
  accessories and Means of transport open at levels 12 to 15, and
  Ingredients and Places and buildings, until now reserved, at 16 and 17 —
  in all seven languages.
- **Signing in.** A player already signed in to CrazyGames whose game account
  could not be opened when the page loaded (our server was overloaded on
  23 November, when the game got a hundred times its usual traffic) stayed a
  guest, and « Sign in » did nothing for them. The game now tries again on
  its own after 5, 15 and 45 seconds and 2 minutes, and « Sign in » retries it.
- **Leaderboards load reliably under traffic.** The home reads its boards at
  most once per half minute, and the server serves them from a cache, so
  they no longer vanish when many players are on at once.
- **The leaderboard's scrollbar no longer flashes** as its rows arrive: the
  rows scroll under a bar whose rail is always drawn.

## 1.7.4

1.7.4 is 1.7.2 with the 1.7.3 point below and the following.

- **Saving relies on the Data Module.** A guest who signs in and then signs
  out gets their own guest progress back, as the SDK keeps it; the account's
  progress never stays on the guest.
- **A scrollbar on iPhone and iPad.** iOS draws no styleable scrollbar, so the
  game draws its own along the right edge whenever the page (the portrait
  main menu) is taller than the screen. Android and desktop keep theirs.
- **The leaderboard scrolls in landscape on Android.** Its rows could take
  the height of the whole board, run under the buttons below and leave
  nothing to scroll; the board now keeps to its place and its rows scroll
  under a bar, checked with touch swipes at 775×380, 926×476 and 1017×498.
- **iOS portrait with the keyboard open** (the frame shown in the top half of
  the screen, the portal's page under it): the frame's size and place under
  the keyboard are the player's. Inside it the run keeps the letter, the
  field, Skip and Enter in view, as the capture shows.

## 1.7.3

- When the SDK fails on an ad request (it throws, rejects, or never calls
  back), « Play again » no longer waits a silent minute: the run starts at
  once on an error, and an ad that has not started within 10 s is given up.
  An ad that actually plays still has up to 60 s. Same for rewarded ads.

## 1.7.2

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
