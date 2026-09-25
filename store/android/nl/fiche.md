# Play Store-vermelding — Letter Minuut (Nederlands)

Teksten en antwoorden om over te nemen in de Play Console. De afbeeldingen:
`../icon-512.png`, `feature-graphic.png` (1024 × 500, in deze map),
`../listing/nl/` (de vijf screenshots met bijschrift om te uploaden,
1080 × 1920) en `../screenshots/nl/` (de ruwe opnamen waaruit ze worden
opgebouwd). Opnieuw genereren: `scripts/render-store.sh`.

## Hoofdvermelding (Nederlands)

**Naam** (max. 30 tekens)
> Letter Minuut

**Korte beschrijving** (max. 80 tekens)
> Stad-land-rivier in sneltreinvaart: één letter, 60 seconden. Daag vrienden uit!

**Volledige beschrijving** (max. 4000 tekens)

> Stad-land-rivier in sneltreinvaart. Er valt een letter, er verschijnt een
> thema, de klok loopt: landen met een B, dieren met een M, beroepen met een
> P… Je hebt zestig seconden om er zoveel mogelijk te vinden.
>
> DAAG JE VRIENDEN UIT
> Nodig tot zeven vrienden uit voor hetzelfde spel: dezelfde letters, dezelfde
> thema’s, iedereen speelt wanneer hij wil. Klassement, trofeeën en revanche.
>
> KRACHTEN OM EEN BEETJE VALS TE SPELEN
> Ruil je letter, zie het volgende thema al aankomen, maak ongestraft twee
> tikfouten… Tien krachten te verdienen: vind je favoriete combinatie.
>
> NIEUWE THEMA’S BIJ ELK LEVEL
> Verdien nieuwe thema’s voor nog meer uitdaging: groente en fruit, beroepen,
> sporten, lichaamsdelen, steden, merken…
>
> VOOR DE FANATIEKELINGEN
> De zeldzaamste woorden leveren tot drie keer zoveel op: kom ze ontdekken, of
> stel zelf woorden voor.
>
> • Zonder registratie, account optioneel
> • Solo offline speelbaar
> • In zeven talen

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
| Advertenties | **Nee**: advertenties staan uit (`ADS_ENABLED`). De AdMob-SDK blijft in de build maar start nooit; terug naar **Ja** zodra ze terugkomen |
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
