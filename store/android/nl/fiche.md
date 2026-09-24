# Play Store-vermelding — Lettre Minute (Nederlands)

Teksten en antwoorden om over te nemen in de Play Console. De afbeeldingen
staan een niveau hoger: `../icon-512.png`, `../feature-graphic.png`
(1024 × 500), `../screenshots/` (1080 × 1920, licht en donker). Opnieuw
genereren: `scripts/render-store.sh`.

## Hoofdvermelding (Nederlands)

**Naam** (max. 30 tekens)
> Lettre Minute

**Korte beschrijving** (max. 80 tekens)
> Eén letter, één categorie, 60 seconden. Zeldzame woorden leveren meer op.

**Volledige beschrijving** (max. 4000 tekens)

> Er valt een letter, er verschijnt een categorie, de klok loopt. Landen met
> een B, dieren met een M, kleuren met een V… Je hebt zestig seconden om
> zoveel mogelijk woorden te schrijven.
>
> Het spel controleert elk woord terwijl je typt, met een woordenboek van
> meer dan {WORD_COUNT} woorden op basis van Wikidata en WikiWoordenboek.
> ‘Katten’ telt als ‘kat’, en een tikfout mag: ‘Duitsladn’ telt als
> ‘Duitsland’.
>
> ZELDZAME WOORDEN LEVEREN MEER OP
> Een woord dat iedereen schrijft, levert 10 punten op. Een woord dat
> niemand vindt, levert tot drie keer zoveel op. En de bonus slijt als je
> elk spel hetzelfde woord gebruikt: varieer dus.
>
> HOU DE REEKS VAST
> Elk woord dat je achter elkaar goed hebt, verhoogt de vermenigvuldiger,
> tot ×2. Overslaan kost vijf seconden en zet de reeks op nul.
>
> STIJG IN LEVEL
> Elk punt levert ervaring op, en elk level ontgrendelt een nieuwe
> categorie: groente en fruit, beroepen, sporten, lichaamsdelen, materialen,
> hoofdsteden, merken, insecten…
>
> LAAT HET WOORDENBOEK GROEIEN
> Mis je een woord? Stel het met één tik voor. Als drie spelers erom vragen,
> komt het in het woordenboek en krijg jij 150 XP.
>
> • Zonder registratie
> • Eén korte advertentie, bij het kiezen van een nieuwe categorie
> • Offline speelbaar
> • Licht en donker thema
> • Wis je gegevens met één tik vanaf het startscherm

**App-categorie**: Game › Woorden
**Tags**: Woorden, Quiz, Singleplayer, Algemene kennis
**Contact-e-mailadres**: nog in te vullen (openbaar op de vermelding)
**Privacybeleid**: het openbare adres van
`store/privacy/confidentialite.nl.html` zodra die gepubliceerd is (nu is
`VITE_PRIVACY_URL` de Franse pagina)

## App-content (Play Console › Beleid › App-content)

| Onderdeel | Antwoord |
| --- | --- |
| App-toegang | Geen beperkingen: alles is toegankelijk zonder in te loggen |
| Advertenties | **Ja**: een AdMob-interstitial na elke categoriekeuze vanaf de tweede |
| Contentclassificatie (IARC) | Categorie ‘Game’; nee op alle vragen (geweld, angst, seksualiteit, gokken, taalgebruik, drugs, digitale aankopen); spelers wisselen geen berichten uit en delen niets met elkaar. Verwacht resultaat: PEGI 3 / Alle leeftijden |
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
- Manier om verwijdering aan te vragen: **ja**, in de app (start › Mijn
  gegevens wissen) en op `VITE_PRIVACY_URL#effacer`

| Gegevenstype (Play) | Wat het hier is | Verzameld | Gedeeld | Tijdelijke verwerking | Verplicht | Doel |
| --- | --- | --- | --- | --- | --- | --- |
| Persoonsgegevens › Gebruikers-ID’s | De anonieme Supabase-ID | Ja | Nee | Nee | Ja | App-functionaliteit |
| App-activiteit › Andere acties | Spellen, scores, gespeelde woorden, XP | Ja | Nee | Nee | Ja | App-functionaliteit |
| App-activiteit › Andere door gebruikers gegenereerde content | Woorden voorgesteld voor het woordenboek | Ja | Nee | Nee | Nee (de speler kiest zelf of hij iets voorstelt) | App-functionaliteit |
| Locatie › Geschatte locatie | Door AdMob afgeleid uit het IP-adres | Ja | Ja | Nee | Ja | Advertenties, analyse, fraudepreventie |
| Apparaat- of andere ID’s | Advertentie-ID (AdMob) | Ja | Ja | Nee | Ja | Advertenties, analyse, fraudepreventie |
| App-activiteit › App-interacties | Weergaven van en tikken op de advertentie (AdMob) | Ja | Ja | Nee | Ja | Advertenties, analyse, fraudepreventie |
| App-informatie en -prestaties › Diagnostiek, Crashlogboeken | Doorgegeven door de AdMob-SDK | Ja | Ja | Nee | Ja | Analyse, fraudepreventie |

Al het andere (precieze locatie, contacten, foto’s, e-mail, naam): **niet
verzameld**.

## Accountverwijdering (Play Console › Beleid › Gegevensverwijdering)

- Kun je in de app een account maken? **Ja**, er wordt automatisch een
  anoniem account aangemaakt
- Verwijderingslink buiten de app: `VITE_PRIVACY_URL#effacer`
- Gedeeltelijke verwijdering van gegevens zonder het account te verwijderen:
  niet aangeboden
