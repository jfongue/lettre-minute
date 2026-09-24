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
> • No sign-up, no ads
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
| Ads | No, the app does not contain ads |
| Content rating (IARC) | “Game” category; no to every question (violence, fear, sexuality, gambling, language, drugs, digital purchases); players exchange no messages and share nothing with each other. Expected result: PEGI 3 / Everyone |
| Target audience | 13 and over. Choosing an age group under 13 puts the app in the Families programme and its additional requirements |
| News app | No |
| Government / health / finance apps | No |
| Advertising ID | No, the app does not use the advertising ID |

## Data safety

To fill in **only if the build ships with the Supabase keys**; without them,
nothing leaves the phone and the answer is “no data collected”.

- Data collection or sharing: **yes, collected**; **not shared**
- Data encrypted in transit: **yes** (HTTPS to Supabase)
- Way to request deletion: **yes**, in the app (home › Erase my data) and at
  `VITE_PRIVACY_URL#effacer`

| Data type (Play) | What it is here | Collected | Shared | Processed ephemerally | Required | Purpose |
| --- | --- | --- | --- | --- | --- | --- |
| Personal info › User IDs | The anonymous Supabase identifier | Yes | No | No | Yes | App functionality |
| App activity › Other actions | Games, scores, words played, XP | Yes | No | No | Yes | App functionality |
| App activity › Other user-generated content | Words suggested for the dictionary | Yes | No | No | No (the player chooses to suggest) | App functionality |

Everything else (location, contacts, photos, email, name, device,
diagnostics, crashes): **not collected**.

## Account deletion (Play Console › Policy › Data deletion)

- Does the app let users create an account? **Yes**, an anonymous account is
  created automatically
- Deletion link outside the app: `VITE_PRIVACY_URL#effacer`
- Partial data deletion without deleting the account: not offered
