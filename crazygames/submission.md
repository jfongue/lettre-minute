# CrazyGames submission — Letter Minute

Ready-to-paste answers for https://developer.crazygames.com/submit (Basic
launch). The build and its choices are explained in `crazygames/README.md`.

## Step 1 — Upload

| Field | Answer |
|---|---|
| Game name (≤ 35 characters) | **Letter Minute** — the title the game shows on its poster in every language (`crazyGamesHost.title`, `src/platform/crazygames.ts`) and in the page title |
| Engine | HTML5 |
| Game files | `crazygames/lettre-minute-crazygames.zip` (4.06 MB; `index.html` at the root, relative paths, 169 files, 14.65 MB unzipped) — rebuild with `npm run crazygames:build` |
| Game save progress | **Yes, using the Data Module from the CrazyGames SDK** (enables « Progress Save »; without it the SDK answers `dataModuleDisabled` and the game falls back to localStorage) |
| Supports mobile | **Yes** |
| Online / multiplayer | **Yes** — the shared leaderboards, and, for a player signed in to CrazyGames, the friends, the head-to-head tally with them, and a live duel with matchmaking inside the game's own language pool. A guest (not signed in) still plays everything solo, and the duel falls back to the house players |
| Supports CrazyGames muting audio through the SDK | **Yes** — `game.settings.muteAudio` and its change listener suspend all game audio, music included; the in-game mute button cannot override it |
| Orientation (mobile) | **Portrait** (desktop plays in a centred column inside the 16:9 frame) |
| SDK integration | HTML5 SDK v3: `init`, `loadingStart/Stop`, `gameplayStart/Stop`, `happytime` (new record), `requestAd('midgame')` between runs, Data module, User module (`getUserToken`, `showAuthPrompt`, `submitScore` for the leaderboards), `systemInfo.locale` |

Weight against the limits (from the build script): 1.63 MB of code, styles
and fonts; dictionaries load per category when a run deals them, so the worst
case before the first `gameplayStart` is 7.28 MB (limit 50 MB, mobile home page
20 MB). Total 14.65 MB (limit 250 MB), 169 files (limit 1,500).

## Step 2 — QA

Test it locally before uploading: `npm run crazygames:build`, then
`npm run crazygames:harness` and open http://localhost:5747/ (or
`/frame.html?size=phone` for the iframe at phone size). The SDK runs in its
`local` mode there and logs every call in the console; the midgame ad shows as
« A midgame ad would appear here » after « Play again ».

What QA will see:

- No login, no form, no language question: the first screen is the poster and
  a **Play** button; the very first Play opens a one-word lesson, then the run.
- English by default; the SDK's locale picks French, Spanish, German, Italian,
  Dutch or Portuguese when it is one of them. Light theme by default.
- No store or app mentions, no account of the game's own: a guest plays
  everything solo, and « Sign in » (leaderboards, profile, friends) opens the
  portal's own login (`showAuthPrompt`). The only external link is the privacy
  policy, in the options.
- Signed in to CrazyGames, the player gets the shared leaderboards, a friends
  tab (add by player name, a friend's line is kept at the top of the boards),
  the head-to-head tally, and the duel: create a table and invite friends, or
  let the matchmaking pair them with a player of their language.

## Step 3 — Details

**Title:** Letter Minute

**Short description** (one line):

> The classic categories game, solo and against the clock: one letter, one category, find a word — sixty seconds, as many as you can.

**Description:**

> Letter Minute is the classic categories game, made fast and played solo. A letter and a category come up — B, Animals — and you type a word that fits. Got one? A new letter and a new category arrive straight away. You have sixty seconds to find as many as you can.
>
> Every answer is checked live against a real dictionary: tens of thousands of animals, countries, cities, jobs, sports, colours, fruit and vegetables and more, with spelling mistakes forgiven on longer words. Common answers score, rare ones score more, and a streak of quick answers multiplies everything.
>
> Level up to unlock new categories and powers: see the next letter coming, freeze the clock for a few seconds, swap a category you dislike, let a typo through. Ban the category you never enjoy, dress your avatar, chase thirty achievements and your own best score.
>
> At the end of each run, discover the words you could have written — the rare ones you never thought of.
>
> Playable in English, French, Spanish, German, Italian, Dutch and Portuguese.

**Controls:**

> Keyboard: type your answer and press Enter. Tab skips to the next letter (or use the Skip button).
> Mouse / touch: tap Play, Enter and Skip; the on-screen keyboard types on phones and tablets.

**Category (proposed):** Puzzle

**Tags (proposed, pick what the form offers):** Word, Typing, Trivia, Quiz,
Brain, Vocabulary, Educational, Casual, Time Management, 1 Player, Mobile

**Other fields likely asked:**

| Field | Answer |
|---|---|
| Languages | English, French, Spanish, German, Italian, Dutch, Portuguese |
| Age rating | PEGI 12 compliant (no violence, no free chat: a duel shows only the words the game's own dictionaries accept) |
| In-game purchases | None |
| Ads | Midgame only, through the SDK (inactive in Basic Launch); no rewarded ads |
| Uses accounts / username | CrazyGames accounts only, optional (User module: `getUserToken`, verified server-side against the portal's public key); a signed-in player appears on the leaderboards under their CrazyGames username, and gets the friends tab, the head-to-head tally and the duel — a guest keeps playing solo, with the duel against the house players |
| Leaderboards | The game's own boards (day / week / all time), shared with its other players: a guest reads them with their own best shown as « Me », counted on the device and never sent; a signed-in CrazyGames player is ranked. Plus one weekly POINTS board through the SDK (`user.submitScore`), once the portal opens leaderboards to the game |
| Release date / previously published | Not yet released as a web game on another portal |
| Privacy policy | https://jfongue.github.io/lettre-minute/confidentialite.en.html (CrazyGames ID and username kept for a signed-in player only) |
| Developer / contact | Demontoon — fongue.jeremy@gmail.com |

## Assets

All in `crazygames/assets/`, rendered by `scripts/crazygames-shots.ts`
(light theme, English):

| File | Size | Use |
|---|---|---|
| `cover-landscape-1920x1080.png` | 1920 × 1080 | landscape cover (16:9) |
| `cover-portrait-800x1200.png` | 800 × 1200 | portrait cover (2:3) |
| `cover-square-800x800.png` | 800 × 800 | square cover (1:1) |
| `shot-0-first-launch.png` … `shot-4-summary.png` | 1920 × 1080 | desktop captures: first launch, home, announcement, run, end of run |
| `shot-mobile-1-home.png` … `shot-mobile-4-summary.png` | 1170 × 2532 | phone captures, portrait |

The covers carry the title as their only text, no border, no icon; the
shapes stand beside the title, never under it. `cover.html` is their source.

**Preview videos**, rendered with HyperFrames from a real run of the build
(`crazygames/video/`: `npm install`, then `node capture.mjs` with the harness
running, then `node render.mjs`):

| File | Size | Content |
|---|---|---|
| `video-landscape-1920x1080.mp4` | 1920 × 1080 (16:9), 19.5 s, H.264, no audio, 2.9 MB | cover → a run typed at a human pace (Football, Italy, Penguin with a typo put right, then Kiwi, rare: the streak climbs to ×1.4) and its summary, with four short captions beside the game → cover |
| `video-portrait-1080x1620.mp4` | 1080 × 1620 (2:3), 19.5 s, H.264, no audio, 3.2 MB | the same, captions under the game |

The portal asks for portrait at « 1080p – 2:3 », the cover's own ratio, so the
portrait video is 1080 × 1620 (not 1080 × 1920): its first frame is the
portrait cover drawn at 1.35×. No fast-forward, no black frames, no cursor.

## Step 4 — Submit

Nothing else to prepare. After a Basic Launch, a Full Launch would only need
the Data module confirmed, the weekly leaderboard enabled (invitation-only on
CrazyGames' side) and, if wanted, rewarded ads (none are offered yet).
