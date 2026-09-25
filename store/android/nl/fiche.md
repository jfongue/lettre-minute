# Play Store-vermelding — Letter Minuut (Nederlands)

Teksten en antwoorden om over te nemen in de Play Console. De afbeeldingen:
`../icon-512.png`, `feature-graphic.png` (1024 × 500, in deze map),
`../listing/nl/` (de acht screenshots met bijschrift om te uploaden,
1080 × 1920) en `../screenshots/nl/` (de ruwe opnamen waaruit ze worden
opgebouwd). Opnieuw genereren: `scripts/render-store.sh`.

## Hoofdvermelding (Nederlands)

**Naam** (max. 30 tekens)
> Letter Minuut

**Korte beschrijving** (max. 80 tekens)
> Eén letter, één categorie, 60 seconden. Zeldzame woorden leveren meer punten op.

**Volledige beschrijving** (max. 4000 tekens)

> Er valt een letter, er verschijnt een categorie, de klok loopt. Landen met
> een B, dieren met een M, kleuren met een R… Je hebt zestig seconden om
> zoveel mogelijk woorden te schrijven, en de woorden die niemand vindt,
> leveren het meest op.
>
> Het spel controleert elk woord terwijl je typt, met een woordenboek van
> meer dan 30.000 Nederlandse woorden op basis van Wikidata en Wiktionary.
> „Katten” telt als „kat”, en een tikfout mag: „Duitsladn” telt als
> „Duitsland”.
>
> ZELDZAME WOORDEN LEVEREN MEER OP
> Een woord dat iedereen schrijft, levert 10 punten op. Een woord dat
> niemand vindt, tot drie keer zoveel. En de bonus slijt als je elk spel
> hetzelfde woord gebruikt: varieer dus.
>
> HOU DE REEKS VAST
> Elk woord dat je achter elkaar goed hebt, verhoogt de vermenigvuldiger,
> tot ×2. Overslaan kost vijf seconden en zet de reeks op nul.
>
> DAAG JE VRIENDEN UIT
> Tot acht spelers in hetzelfde spel: dezelfde letters, dezelfde categorieën,
> ieder wanneer hij wil, binnen 24 uur. Terwijl jij speelt, lopen de scores
> van wie al gespeeld heeft live met je mee. Aan het eind geldt de
> Petit-Bac-regel: een woord dat een ander ook vond, telt maar half.
> Eindstand, trofeeën, en een revanche als je daar zin in hebt.
>
> TIEN KRACHTEN
> Typ „sst” en de klok staat stil. Typ „Joker” en het spel vindt een woord
> voor je. Ruil je letter, zie de volgende categorie al aankomen, maak
> ongestraft twee tikfouten… Om de twee levels een nieuwe kracht, en twee
> mee in elk spel.
>
> STIJG IN LEVEL
> Elk punt levert ervaring op, en bij elk level krijg je drie nieuwe
> categorieën aangeboden, waarvan je er één houdt: groente en fruit,
> beroepen, sporten, lichaamsdelen, materialen, hoofdsteden, merken…
> Onderweg ontgrendel je veertig geanimeerde avatars en dertig kleuren.
>
> KLIM IN HET KLASSEMENT
> Beste spel van de dag, van de week, en de jacht op ontdekkingen: woorden
> die al zeven dagen niemand meer had geschreven.
>
> LAAT HET WOORDENBOEK GROEIEN
> Mis je een woord? Stel het met één tik voor. Keuren drie moderators het
> goed, dan komt het in het woordenboek en krijg jij 150 XP.
>
> • Zonder registratie: een account is optioneel (e-mail of Google)
> • Eén korte advertentie, bij het kiezen van een nieuwe categorie
> • Solo offline speelbaar
> • In zeven talen, elk met een eigen woordenboek: Nederlands, Engels,
>   Frans, Duits, Spaans, Italiaans, Portugees
> • Live gespeelde muziek en geluiden, licht en donker thema
> • Wis je gegevens met één tik vanuit het menu

**App-categorie**: Game › Woorden
**Tags** (max. 5, uit de lijst van de Play Console): Woorden, Quiz,
Algemene kennis, Singleplayer, Multiplayer
**Contact-e-mailadres**: fongue.jeremy@gmail.com (openbaar op de vermelding)
**Privacybeleid** (de Play Console neemt één adres voor de hele app):
https://jfongue.github.io/lettre-minute/confidentialite.html, oftewel
`VITE_PRIVACY_URL` (Frans). De Nederlandse vertaling staat op
https://jfongue.github.io/lettre-minute/confidentialite.nl.html; beide
pagina’s verwijzen naar elkaar

## App-content (Play Console › Beleid › App-content)

| Onderdeel | Antwoord |
| --- | --- |
| App-toegang | Geen beperkingen: alles is toegankelijk zonder in te loggen |
| Advertenties | **Ja**: een AdMob-interstitial na elke categoriekeuze vanaf de tweede |
| Contentclassificatie (IARC) | Categorie ‘Game’; nee op alle vragen (geweld, angst, seksualiteit, gokken, taalgebruik, drugs, digitale aankopen); **interactie tussen gebruikers: ja** (spelersnaam, avatar en scores zichtbaar in het klassement, bij vrienden en in uitdagingen; geen berichten, geen vrije tekst uitgewisseld behalve de naam). Verwacht resultaat: PEGI 3 / Alle leeftijden, met de vermelding ‘Gebruikers hebben interactie’ |
| Doelgroep | 13 jaar en ouder. Een leeftijdsgroep onder 13 jaar kiezen brengt de app in het Gezinnenprogramma met de extra vereisten daarvan |
| Nieuwsapp | Nee |
| Overheids- / gezondheids- / financiële apps | Nee |
| Advertentie-ID | **Ja**, via de AdMob-SDK; doelen: advertenties, analyse, fraudepreventie. De toestemming `AD_ID` wordt door de SDK aan het manifest toegevoegd |

## Gegevensveiligheid

De Supabase-rijen gelden alleen als de build de sleutels ervan bevat; de
AdMob-rijen gelden voor elke Android-build, want de advertentie-SDK zit er
altijd in. De AdMob-verklaringen volgen de handleiding ‘Gegevensveiligheid’ in
de AdMob Help en moeten bij elke SDK-update opnieuw worden nagelezen.

- Verzamelen of delen van gegevens: **ja, verzameld** en **ja, gedeeld**
  (met Google, voor advertenties)
- Gegevens versleuteld tijdens overdracht: **ja** (HTTPS naar Supabase en
  Google)
- Manier om verwijdering aan te vragen: **ja**, in de app (Menu › Profiel ›
  Mijn gegevens wissen) en op
  https://jfongue.github.io/lettre-minute/confidentialite.nl.html#effacer
  (`VITE_PRIVACY_URL#effacer` voor de Franse pagina)

| Gegevenstype (Play) | Wat het hier is | Verzameld | Gedeeld | Tijdelijke verwerking | Verplicht | Doel |
| --- | --- | --- | --- | --- | --- | --- |
| Persoonlijke informatie › Gebruikers-ID’s | De anonieme Supabase-ID | Ja | Nee | Nee | Ja | App-functionaliteit |
| Persoonlijke informatie › Naam | Spelersnaam, gekozen bij het aanmaken van het account, zichtbaar voor andere spelers | Ja | Nee | Nee | Nee (account is optioneel) | App-functionaliteit, accountbeheer |
| Persoonlijke informatie › E-mailadres | Inloggen en code om het wachtwoord opnieuw in te stellen (ingetypt of doorgegeven door Google) | Ja | Nee | Nee | Nee (account is optioneel) | App-functionaliteit, accountbeheer |
| Persoonlijke informatie › Andere informatie | Vriendenlijst, uitdagingen | Ja | Nee | Nee | Nee | App-functionaliteit |
| Apparaat- of andere ID’s | Firebase-meldingstoken (uitdagingen) | Ja | Nee | Nee | Nee (de speler staat meldingen toe) | App-functionaliteit |
| App-activiteit › Andere acties | Spellen, scores, gespeelde woorden, XP | Ja | Nee | Nee | Ja | App-functionaliteit |
| App-activiteit › Andere door gebruikers gegenereerde content | Woorden voorgesteld voor het woordenboek | Ja | Nee | Nee | Nee (de speler kiest zelf of hij iets voorstelt) | App-functionaliteit |
| Locatie › Geschatte locatie | Door AdMob afgeleid uit het IP-adres | Ja | Ja | Nee | Ja | Advertenties, analyse, fraudepreventie |
| Apparaat- of andere ID’s | Advertentie-ID (AdMob) | Ja | Ja | Nee | Ja | Advertenties, analyse, fraudepreventie |
| App-activiteit › App-interacties | Weergaven van en tikken op de advertentie (AdMob) | Ja | Ja | Nee | Ja | Advertenties, analyse, fraudepreventie |
| App-informatie en -prestaties › Diagnostiek, Crashlogboeken | Doorgegeven door de AdMob-SDK | Ja | Ja | Nee | Ja | Analyse, fraudepreventie |

Al het andere (precieze locatie, contacten, foto’s, telefoonnummer): **niet
verzameld**. Het wachtwoord wordt alleen gehasht bewaard, door Supabase Auth.

## Accountverwijdering (Play Console › Beleid › Gegevensverwijdering)

- Kun je in de app een account maken? **Ja**: er wordt automatisch een
  anoniem account aangemaakt, en de speler kan het een naam geven (naam,
  e-mail, wachtwoord, of Google). Wissen verwijdert het account, anoniem of met naam
- Verwijderingslink buiten de app:
  https://jfongue.github.io/lettre-minute/confidentialite.nl.html#effacer
- Gedeeltelijke verwijdering van gegevens zonder het account te verwijderen:
  niet aangeboden
