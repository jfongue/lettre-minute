# Play Store listing — Lettre Minute (English)

Texts and answers to copy into the Play Console. The visuals are one level up:
`../icon-512.png`, `../feature-graphic.png` (1024 × 500), `../screenshots/`
(1080 × 1920, light and dark). To regenerate them: `scripts/render-store.sh`.

## Main listing (English)

**App name** (30 characters max)
> Lettre Minute

**Short description** (80 characters max)
> One letter, one category, 60 seconds. The rarer the word, the more it scores.

**Full description** (4,000 characters max)

> A letter drops, a category appears, the clock starts. Countries starting
> with B, animals with M, colours with V… You have sixty seconds to write as
> many words as you can.
>
> The game checks every word as you type, using a dictionary of over
> {WORD_COUNT} words built on Wikidata and Wiktionary. “Cats” counts as
> “cat”, and a typo gets through: “Portgual” counts as “Portugal”.
>
> RARE WORDS ARE WORTH MORE
> A word everyone writes earns 10 points. A word nobody finds earns up to
> three times as much. And the bonus wears off if you bring out the same word
> every game: mix it up.
>
> KEEP IT GOING
> Every word validated in a row raises the multiplier, up to ×2. Skipping
> costs five seconds and resets the streak.
>
> LEVEL UP
> Every point earns experience, and every level unlocks a new category: fruit
> and vegetables, jobs, sports, parts of the body, materials, capitals,
> brands, insects…
>
> HELP THE DICTIONARY GROW
> A word missing? Suggest it in one tap. Once three players have asked for
> it, it joins the dictionary, and you earn 150 XP.
>
> • No sign-up
> • A single short ad, when you pick a new category
> • Playable offline
> • Light and dark theme
> • Erase your data in one tap from the home screen

**App category**: Game › Word
**Tags**: Word, Trivia, Single player, General knowledge
**Contact email address**: to be filled in (public on the listing)
**Privacy policy**: the public address of `store/privacy/confidentialite.en.html`
once published (the French page today is `VITE_PRIVACY_URL`)

## App content (Play Console › Policy › App content)

| Section | Answer |
| --- | --- |
| App access | No restrictions: everything is available without signing in |
| Ads | **Yes**: an AdMob interstitial after each category pick from the second one on |
| Content rating (IARC) | “Game” category; no to every question (violence, fear, sexuality, gambling, language, drugs, digital purchases); players exchange no messages and share nothing with each other. Expected result: PEGI 3 / Everyone |
| Target audience | 13 and over. Choosing an age group under 13 puts the app in the Families programme and its additional requirements |
| News app | No |
| Government / health / finance apps | No |
| Advertising ID | **Yes**, through the AdMob SDK; purposes: advertising, analytics, fraud prevention. The `AD_ID` permission is added to the manifest by the SDK |

## Data safety

The Supabase rows apply only if the build ships with its keys; the AdMob rows
apply to every Android build, since the ad SDK is always in it. The AdMob
declarations follow the “Data safety” guide in the AdMob help, to be reread at
every SDK update.

- Data collection or sharing: **yes, collected** and **yes, shared**
  (with Google, for advertising)
- Data encrypted in transit: **yes** (HTTPS to Supabase and Google)
- Way to request deletion: **yes**, in the app (home › Erase my data) and at
  `VITE_PRIVACY_URL#effacer`

| Data type (Play) | What it is here | Collected | Shared | Processed ephemerally | Required | Purpose |
| --- | --- | --- | --- | --- | --- | --- |
| Personal info › User IDs | The anonymous Supabase identifier | Yes | No | No | Yes | App functionality |
| App activity › Other actions | Games, scores, words played, XP | Yes | No | No | Yes | App functionality |
| App activity › Other user-generated content | Words suggested for the dictionary | Yes | No | No | No (the player chooses to suggest) | App functionality |
| Location › Approximate location | Inferred from the IP address by AdMob | Yes | Yes | No | Yes | Advertising, analytics, fraud prevention |
| Device or other IDs | Advertising ID (AdMob) | Yes | Yes | No | Yes | Advertising, analytics, fraud prevention |
| App activity › App interactions | Ad views and taps (AdMob) | Yes | Yes | No | Yes | Advertising, analytics, fraud prevention |
| App info and performance › Diagnostics, Crash logs | Reported by the AdMob SDK | Yes | Yes | No | Yes | Analytics, fraud prevention |

Everything else (precise location, contacts, photos, email, name): **not
collected**.

## Account deletion (Play Console › Policy › Data deletion)

- Does the app let users create an account? **Yes**, an anonymous account is
  created automatically
- Deletion link outside the app: `VITE_PRIVACY_URL#effacer`
- Partial data deletion without deleting the account: not offered
