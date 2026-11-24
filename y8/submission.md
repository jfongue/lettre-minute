# Y8 submission — Letter Minute

What the Developer Portal holds for the game « Letter Minute »
(developer.y8.com/games/letter_minute/edit), so a later edit starts from it.
The build and its choices are explained in `y8/README.md`.

## Builds

| Build | Version | Uploaded | Notes |
|---|---|---|---|
| 001 | 1.0.0 | 2026-11-24 | First build. Game scaling: adapts to any size or aspect ratio. |

The drop zone is a cross-origin frame: the zip is dragged in by hand, then
« Add draft build ».

## Basic Info

**Description:**

> Letter Minute is the classic categories game, made fast and played solo. A letter and a category come up (B, Animals) and you type a word that fits. Got one? A new letter and a new category arrive straight away. You have sixty seconds to find as many as you can.
>
> Every answer is checked live against a real dictionary: tens of thousands of animals, countries, cities, jobs, sports, colours, fruit and vegetables and more, with spelling mistakes forgiven on longer words. Common answers score, rare ones score more, and a streak of quick answers multiplies everything.
>
> Level up to unlock new categories and powers: see the next letter coming, freeze the clock for a few seconds, swap a category you dislike, let a typo through. Take on the weekly challenge, climb the shared leaderboards, dress your avatar and chase your own best score.
>
> At the end of each run, discover the words you could have written: the rare ones you never thought of.
>
> Playable in English, French, Spanish, German, Italian, Dutch and Portuguese.

**Instructions:**

> Keyboard: type your answer and press Enter. Tab skips to the next letter (or use the Skip button).
> Mouse / touch: tap Play, Enter and Skip; the on-screen keyboard types on phones and tablets.

| Field | Answer |
|---|---|
| Content safety | Neither blood nor casino |
| Supported platforms | Desktop, Mobile |
| Game features | Online Save only (Y8's cloud save, `saveData`). The game's own leaderboards and achievements do not go through Y8's SDK, so those boxes stay empty |
| AI declaration | « The game was developed with AI assistance ». Not ticked: « primarily created using generative AI », « uses AI-generated graphics, music or other assets » (confirmed: no asset of the game is AI-generated) |

## Media

Rendered by `sh scripts/y8-media.sh` into `y8/assets/`, uploaded on 2026-11-24:

| Slot | Files |
|---|---|
| Standard screenshot 760×570 | `screenshot-1…3-760x570.png`: home, announcement, run (4:3 cut of the CrazyGames captures; the summary is too wide for it) |
| Widescreen 1280×720 | `widescreen-1…4-1280x720.png`: home, announcement, run, summary |
| Landscape promo 1920×1080 | `promo-landscape-1920x1080.png` |
| Portrait promo 1080×1920 | `promo-portrait-1080x1920.png` |
| Game card promo 760×570 | `promo-card-760x570.png` |
| Gameplay video | `gameplay-1920x1080.mp4`: 31 s, one continuous real run from the countdown to the summary. Y8 refuses trailers, so not the CrazyGames preview video: `node crazygames/video/capture.mjs <harness> --landscape` films it |

## Still to do before « Request Review »

- Y8's QA tab is not working yet (placeholder data, buttons that lead nowhere).
- « Request Review » sends the game to Y8's team: on Jérémy's word only.
