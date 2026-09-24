# Play-Store-Eintrag — Letter Minute (Deutsch)

Texte und Antworten zum Übertragen in die Play Console. Die Grafiken liegen
eine Ebene höher: `../icon-512.png`, `feature-graphic.png` (1024 × 500, in diesem Ordner),
`../screenshots/` (1080 × 1920, hell und dunkel). Zum Neuerzeugen:
`scripts/render-store.sh`.

## Haupteintrag (Deutsch)

**Name** (max. 30 Zeichen)
> Letter Minute

**Kurzbeschreibung** (max. 80 Zeichen)
> Ein Buchstabe, eine Kategorie, 60 Sekunden. Seltene Wörter bringen mehr.

**Vollständige Beschreibung** (max. 4.000 Zeichen)

> Ein Buchstabe fällt, eine Kategorie erscheint, die Uhr läuft. Länder mit B,
> Tiere mit M, Farben mit V … Du hast sechzig Sekunden, um so viele Wörter
> wie möglich zu schreiben.
>
> Das Spiel prüft jedes Wort, während du tippst – mit einem Wörterbuch aus
> über 55.000 Wörtern auf Basis von Wikidata und Wiktionary. „Katzen“
> zählt als „Katze“, und ein Tippfehler geht durch: „Österriech“ zählt als
> „Österreich“.
>
> SELTENE WÖRTER ZÄHLEN MEHR
> Ein Wort, das alle schreiben, bringt 10 Punkte. Ein Wort, auf das niemand
> kommt, bringt bis zu dreimal so viel. Und der Bonus nutzt sich ab, wenn du
> in jeder Runde dasselbe Wort bringst: Abwechslung zahlt sich aus.
>
> BLEIB DRAN
> Jedes Wort in Folge erhöht den Multiplikator, bis zu ×2. Überspringen
> kostet fünf Sekunden und setzt die Serie zurück.
>
> STEIG AUF
> Jeder Punkt bringt Erfahrung, und jedes Level schaltet eine neue Kategorie
> frei: Obst und Gemüse, Berufe, Sportarten, Körperteile,
> Materialien, Hauptstädte, Marken …
>
> LASS DAS WÖRTERBUCH WACHSEN
> Ein Wort fehlt? Schlag es mit einem Tipp vor. Sobald drei Spieler es
> wünschen, kommt es ins Wörterbuch, und du bekommst 150 XP.
>
> • Ohne Anmeldung
> • Nur eine kurze Werbung, bei der Wahl einer neuen Kategorie
> • Offline spielbar
> • Helles und dunkles Design
> • Deine Daten lassen sich auf dem Startbildschirm mit einem Tipp löschen

**App-Kategorie**: Spiel › Wörter
**Tags**: Wörter, Quiz, Einzelspieler, Allgemeinwissen
**Kontakt-E-Mail-Adresse**: noch einzutragen (öffentlich im Eintrag)
**Datenschutzerklärung**: die öffentliche Adresse von
`store/privacy/confidentialite.de.html` nach der Veröffentlichung (derzeit
ist `VITE_PRIVACY_URL` die französische Seite)

## App-Inhalte (Play Console › Richtlinien › App-Inhalte)

| Abschnitt | Antwort |
| --- | --- |
| App-Zugriff | Keine Einschränkung: alles ist ohne Anmeldung zugänglich |
| Anzeigen | **Ja**: eine AdMob-Interstitial-Anzeige nach jeder Kategoriewahl ab der zweiten |
| Einstufung des Inhalts (IARC) | Kategorie „Spiel“; Nein bei allen Fragen (Gewalt, Angst, Sexualität, Glücksspiel, Sprache, Drogen, digitale Käufe); die Spieler tauschen keine Nachrichten aus und teilen nichts miteinander. Erwartetes Ergebnis: PEGI 3 / USK ab 0 |
| Zielgruppe | Ab 13 Jahren. Wer eine Altersgruppe unter 13 wählt, bringt die App ins Familienprogramm mit seinen zusätzlichen Anforderungen |
| Nachrichten-App | Nein |
| Behörden- / Gesundheits- / Finanz-Apps | Nein |
| Werbe-ID | **Ja**, durch das AdMob-SDK; Zwecke: Werbung, Analysen, Betrugsprävention. Die Berechtigung `AD_ID` fügt das SDK dem Manifest hinzu |

## Datensicherheit

Die Supabase-Zeilen gelten nur, wenn der Build ihre Schlüssel enthält; die
AdMob-Zeilen gelten für jeden Android-Build, da das Werbe-SDK immer enthalten
ist. Die AdMob-Angaben folgen dem Leitfaden „Datensicherheit“ in der
AdMob-Hilfe und sind bei jedem SDK-Update erneut zu prüfen.

- Erhebung oder Weitergabe von Daten: **ja, Erhebung** und **ja, Weitergabe**
  (an Google, für Werbung)
- Daten bei der Übertragung verschlüsselt: **ja** (HTTPS zu Supabase und Google)
- Möglichkeit, die Löschung zu beantragen: **ja**, in der App (Start ›
  Meine Daten löschen) und unter `VITE_PRIVACY_URL#effacer`

| Datentyp (Play) | Was es hier ist | Erhoben | Weitergegeben | Kurzzeitige Verarbeitung | Erforderlich | Zweck |
| --- | --- | --- | --- | --- | --- | --- |
| Personenbezogene Daten › Nutzer-IDs | Die anonyme Supabase-Kennung | Ja | Nein | Nein | Ja | App-Funktionalität |
| App-Aktivitäten › Sonstige Aktionen | Runden, Punktzahlen, gespielte Wörter, XP | Ja | Nein | Nein | Ja | App-Funktionalität |
| App-Aktivitäten › Sonstige von Nutzern erstellte Inhalte | Für das Wörterbuch vorgeschlagene Wörter | Ja | Nein | Nein | Nein (der Spieler entscheidet sich für einen Vorschlag) | App-Funktionalität |
| Standort › Ungefährer Standort | Von AdMob aus der IP-Adresse abgeleitet | Ja | Ja | Nein | Ja | Werbung, Analysen, Betrugsprävention |
| Geräte- oder andere IDs | Werbe-ID (AdMob) | Ja | Ja | Nein | Ja | Werbung, Analysen, Betrugsprävention |
| App-Aktivitäten › App-Interaktionen | Einblendungen der Werbung und Tipps darauf (AdMob) | Ja | Ja | Nein | Ja | Werbung, Analysen, Betrugsprävention |
| App-Informationen und -Leistung › Diagnose, Absturzprotokolle | Vom AdMob-SDK übermittelt | Ja | Ja | Nein | Ja | Analysen, Betrugsprävention |

Alles andere (genauer Standort, Kontakte, Fotos, E-Mail, Name): **nicht
erhoben**.

## Kontolöschung (Play Console › Richtlinien › Datenlöschung)

- Können Nutzer in der App ein Konto erstellen? **Ja**, ein anonymes Konto
  wird automatisch erstellt
- Link zur Löschung außerhalb der App: `VITE_PRIVACY_URL#effacer`
- Teilweise Löschung der Daten, ohne das Konto zu löschen: nicht angeboten
