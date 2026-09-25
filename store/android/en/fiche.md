# Play Store listing — Letter Minute (English)

Texts and answers to copy into the Play Console. The visuals: `../icon-512.png`,
`feature-graphic.png` (1024 × 500, in this folder), `../listing/en/` (the five
captioned screenshots to upload, 1080 × 1920) and `../screenshots/en/` (the raw
captures they are built from). To regenerate them: `scripts/render-store.sh`.

## Main listing (English)

**App name** (30 characters max)
> Letter Minute

**Short description** (80 characters max)
> The classic categories game, fast: one letter, 60 seconds. Challenge friends!

**Full description** (4,000 characters max)

> The classic categories game, at lightning speed. A letter drops, a category
> appears, the clock starts: countries starting with B, animals with M, jobs
> with P… You have sixty seconds to find as many as you can.
>
> CHALLENGE YOUR FRIENDS
> Invite up to seven friends to the same game: same letters, same categories,
> everyone plays whenever they like. Rankings, trophies and rematches.
>
> POWERS TO CHEAT A LITTLE
> Swap your letter, see the next category coming, let two mistakes slide… Ten
> powers to earn: find your favourite combo.
>
> NEW CATEGORIES AT EVERY LEVEL
> Earn new categories for an even bigger challenge: fruit and vegetables,
> jobs, sports, parts of the body, cities, brands…
>
> FOR THE DIE-HARDS
> The rarest words score up to three times as much: come and discover them, or
> suggest your own.
>
> • No sign-up, account optional
> • Solo play works offline
> • In seven languages

**App category**: Game › Word
**Tags** (5 at most, from the Play Console list): Word, Trivia, General
knowledge, Single player, Multiplayer
**Contact email address**: fongue.jeremy@gmail.com (public on the listing)
**Privacy policy** (a single address for the whole app):
https://jfongue.github.io/lettre-minute/confidentialite.html (French), i.e.
`VITE_PRIVACY_URL`; the English translation is at
https://jfongue.github.io/lettre-minute/confidentialite.en.html, and the two
pages link to each other

## App content (Play Console › Policy › App content)

| Section | Answer |
| --- | --- |
| App access | No restrictions: everything is available without signing in |
| Ads | **No**: ads are switched off (`ADS_ENABLED`). The AdMob SDK stays in the build but never starts; switch back to **Yes** when ads return |
| Content rating (IARC) | “Game” category; no to every question (violence, fear, sexuality, gambling, language, drugs, digital purchases); **users can interact: yes** (player name, avatar and scores visible on the leaderboards, between friends and in challenges; no messaging, no free text exchanged apart from the name). Expected result: PEGI 3 / Everyone, with the “Users Interact” notice |
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
- Way to request deletion: **yes**, in the app (Menu › Profile › Erase my
  data) and at https://jfongue.github.io/lettre-minute/confidentialite.en.html#effacer

| Data type (Play) | What it is here | Collected | Shared | Processed ephemerally | Required | Purpose |
| --- | --- | --- | --- | --- | --- | --- |
| Personal info › User IDs | The anonymous Supabase identifier | Yes | No | No | Yes | App functionality |
| Personal info › Name | Player name, chosen when creating the account, visible to other players | Yes | No | No | No (account optional) | App functionality, Account management |
| Personal info › Email address | Sign-in and password reset code (typed in or passed on by Google) | Yes | No | No | No (account optional) | App functionality, Account management |
| Personal info › Other info | Friends list, challenges | Yes | No | No | No | App functionality |
| Device or other IDs | Firebase notification token (challenges) | Yes | No | No | No (the player accepts notifications) | App functionality |
| App activity › Other actions | Games, scores, words played, XP | Yes | No | No | Yes | App functionality |
| App activity › Other user-generated content | Words suggested for the dictionary | Yes | No | No | No (the player chooses to suggest) | App functionality |
| Location › Approximate location | Inferred from the IP address by AdMob | Yes | Yes | No | Yes | Advertising or marketing, Analytics, Fraud prevention, security, and compliance |
| Device or other IDs | Advertising ID (AdMob) | Yes | Yes | No | Yes | Advertising or marketing, Analytics, Fraud prevention, security, and compliance |
| App activity › App interactions | Ad views and taps (AdMob) | Yes | Yes | No | Yes | Advertising or marketing, Analytics, Fraud prevention, security, and compliance |
| App info and performance › Diagnostics, Crash logs | Reported by the AdMob SDK | Yes | Yes | No | Yes | Analytics, Fraud prevention, security, and compliance |

Everything else (precise location, contacts, photos, phone number): **not
collected**. The password is kept only as a hash, by Supabase Auth.

## Account deletion (Play Console › Policy › Data deletion)

- Does the app let users create an account? **Yes**: an anonymous account is
  created automatically, and the player can name it (name, email, password,
  or Google). Erasing deletes either kind
- Deletion link outside the app:
  https://jfongue.github.io/lettre-minute/confidentialite.en.html#effacer
- Partial data deletion without deleting the account: not offered
