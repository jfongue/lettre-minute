# Letter Minute — the daily word game

**One letter, one category, sixty seconds.** Every day, a new post brings the
same game to everyone in the community: five categories (countries, animals,
colours, jobs…) and a letter at a time. Type a word that fits, validate, and
the next letter comes. The words nobody else writes are worth the most.

It is the classic categories game, made quick and played alone, together:
everyone plays the same letters in the same order, and the post's leaderboard
shows who went furthest.

## For players

- **Tap “Play”** on today's post. The game opens full screen.
- **Write a word** in the category that starts with the letter shown, then
  press Enter (or the button). The game checks it as you type against a
  dictionary of tens of thousands of words: “Aardvark” is an animal,
  “Azerbaijan” a country. Plurals and spelling slips of one letter are
  accepted; a corrected word is paid the base rate.
- **Skip** costs five seconds of the clock, never points.
- **Rare words pay more.** Every word has a rarity — common, uncommon, rare,
  very rare — and a streak of answers raises its points.
- **Your first game of the day counts** for the post's leaderboard. You can
  replay for fun afterwards; it is not counted.
- **At the end**, see your words one by one, where you stand on the post, your
  run of days in a row, and the words *nobody else on the post found*.
- **Share your result** with the “Share in the comments” button: it posts a
  grid of coloured squares (one per word, by rarity) as a reply to the post's
  pinned comment, from your account, only when you tap it. No word is given
  away.
- Readers who are not logged in can play; their game is shown but not kept.
- The game makes sounds only after you touch it, mutes itself when you scroll
  away, and has a mute button in the corner.

## For moderators

1. **Install** the app on your subreddit.
2. **Choose the language** in the app's settings (*Language of the daily
   game*): English by default, or French, Spanish, German, Italian, Dutch or
   Portuguese. It sets the dictionary and the texts of the next posts.
3. **That's all.** Installing creates today's post; a new one is posted every
   day at midnight UTC.
4. If a day's post is missing, use the subreddit menu action **“Post today's
   game”**: it creates the post, or opens it if it already exists. A day never
   gets two posts.

Each post also carries a plain-text description of the day's game, which old
Reddit, third-party apps and AutoModerator read.

## What the app stores

Everything lives in the app's own storage on Reddit, for this subreddit only.
Nothing leaves Reddit: the app calls no outside service, shows no ads and
tracks nothing.

- **Per post:** the day, its language and its five categories; the score of
  each player's counted game with their username; the words they found; how
  many players found each word.
- **Per player:** the last day they played and their run of days in a row.
- **When a post is deleted or removed**, everything stored for it is erased.

## Permissions

- **Redis** — the storage above.
- **Reddit API** — to create the daily post and its pinned comment from the
  app's account.
- **Submit a comment as the user** — only for the “Share in the comments”
  button, on the player's explicit tap.

## For developers

The game shares its rules with the Android app *Lettre Minute*, from the
repository one level up: `src/domain/` (the rules, pure and seeded),
`src/data/words/` (the dictionaries), `src/i18n/` (the texts) and the game's
own screens from `src/ui/`. A day's game follows its date and language alone
(`src/domain/daily.ts`), so every reader on every device plays the same one.

```bash
npm install            # here, and once at the repository root
npm run check          # types, client and server
npm run harness        # plays the build in a browser, against a mocked post
npm run dev            # devvit playtest on the test subreddit
npm run launch         # upload and submit for review
```
