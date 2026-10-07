# CrazyGames submission — Letter Minute

Ready-to-paste answers for https://developer.crazygames.com/submit (Basic
launch). The build and its choices are explained in `crazygames/README.md`.

## Step 1 — Upload

| Field | Answer |
|---|---|
| Game name (≤ 35 characters) | **Letter Minute** — the title the game shows on its poster in every language (`CRAZYGAMES_TITLE`) and in the page title |
| Engine | HTML5 |
| Game files | `crazygames/lettre-minute-crazygames.zip` (3.75 MB; `index.html` at the root, relative paths, 148 files, 13.5 MB unzipped) — rebuild with `npm run crazygames:build` |
| Game save progress | **Yes, using the Data Module from the CrazyGames SDK** (enables « Progress Save »; without it the SDK answers `dataModuleDisabled` and the game falls back to localStorage) |
| Supports mobile | **Yes** |
| Online / multiplayer | **No** — single player, plays offline once loaded |
| Supports CrazyGames muting audio through the SDK | **Yes** — `game.settings.muteAudio` and its change listener suspend all game audio, music included; the in-game mute button cannot override it |
| Orientation (mobile) | **Portrait** (desktop plays in a centred column inside the 16:9 frame) |
| SDK integration | HTML5 SDK v3: `init`, `loadingStart/Stop`, `gameplayStart/Stop`, `happytime` (new record), `requestAd('midgame')` between runs, Data module, `systemInfo.locale` |

Weight against the limits (from the build script): 1.26 MB of code, styles
and fonts; dictionaries load per category when a run deals them, so the worst
case before the first `gameplayStart` is 6.9 MB (limit 50 MB, mobile home page
20 MB). Total 13.5 MB (limit 250 MB), 148 files (limit 1,500).

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
- No external links of any kind, no store or app mentions, no account.

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
| Age rating | PEGI 12 compliant (no violence, no chat, no user-generated content shown to others) |
| In-game purchases | None |
| Ads | Midgame only, through the SDK (inactive in Basic Launch); no rewarded ads |
| Uses accounts / username | No |
| Release date / previously published | Not yet released as a web game on another portal |
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

**Not provided:** the preview videos (15–20 s, landscape and portrait 1080p,
no sound, first frame = the cover) — to record from a real run.

## Step 4 — Submit

Nothing else to prepare. After a Basic Launch, a Full Launch would only need
the Data module confirmed and, if wanted, rewarded ads (none are offered yet).
