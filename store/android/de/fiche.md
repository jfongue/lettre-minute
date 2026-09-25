# Play-Store-Eintrag — Letter Minute (Deutsch)

Texte und Antworten zum Übertragen in die Play Console. Die Grafiken:
`../icon-512.png`, `feature-graphic.png` (1024 × 500, in diesem Ordner),
`../listing/de/` (die acht beschrifteten Screenshots zum Hochladen,
1080 × 1920) und `../screenshots/de/` (die Rohaufnahmen, aus denen sie
entstehen). Zum Neuerzeugen: `scripts/render-store.sh`.

## Haupteintrag (Deutsch)

**Name** (max. 30 Zeichen)
> Letter Minute

**Kurzbeschreibung** (max. 80 Zeichen)
> Ein Buchstabe, eine Kategorie, 60 Sekunden. Je seltener das Wort, desto mehr.

**Vollständige Beschreibung** (max. 4.000 Zeichen)

> Ein Buchstabe fällt, eine Kategorie erscheint, die Uhr läuft. Länder mit B,
> Tiere mit M, Farben mit V … Du hast sechzig Sekunden, um so viele Wörter
> wie möglich zu schreiben – und die, auf die sonst keiner kommt, bringen am
> meisten.
>
> Das Spiel prüft jedes Wort, während du tippst – mit einem Wörterbuch aus
> über 40.000 deutschen Wörtern auf Basis von Wikidata und Wiktionary.
> „Katzen“ zählt als „Katze“, und ein Tippfehler geht durch: „Österriech“
> zählt als „Österreich“.
>
> SELTENE WÖRTER ZÄHLEN MEHR
> Ein Wort, das alle schreiben, bringt 10 Punkte. Ein Wort, auf das niemand
> kommt, bringt bis zu dreimal so viel. Und der Bonus nutzt sich ab, wenn du
> in jeder Partie dasselbe Wort bringst: Abwechslung zahlt sich aus.
>
> BLEIB DRAN
> Jedes Wort in Folge erhöht den Multiplikator, bis zu ×2. Überspringen
> kostet fünf Sekunden und setzt die Serie zurück.
>
> FORDERE DEINE FREUNDE HERAUS
> Bis zu acht Spieler in derselben Partie: dieselben Buchstaben, dieselben
> Kategorien, jeder wann er will, innerhalb von 24 Stunden. Während du
> spielst, laufen die Punkte derer, die schon dran waren, mit wie live. Am
> Ende gilt die Stadt-Land-Fluss-Regel: Ein Wort, das ein anderer auch
> gefunden hat, zählt nur die Hälfte. Rangliste, Trophäen und eine Revanche,
> wenn du Lust hast.
>
> ZEHN KRÄFTE
> Tipp „pst“, und die Uhr steht still. Tipp „Joker“, und das Spiel findet ein
> Wort für dich. Zieh einen neuen Buchstaben, sieh die nächste Kategorie
> kommen, lass zwei Tippfehler durchgehen … Alle zwei Level gibt es eine neue
> Kraft, zwei nimmst du in jede Partie mit.
>
> STEIG AUF
> Jeder Punkt bringt Erfahrung, und jedes Level bietet dir drei neue
> Kategorien an, von denen du eine behältst: Obst und Gemüse, Berufe,
> Sportarten, Körperteile, Materialien, Hauptstädte, Marken … Unterwegs
> warten vierzig animierte Avatare und dreißig Farben darauf, freigeschaltet
> zu werden.
>
> KLETTERE IN DER RANGLISTE
> Beste Partie des Tages, der Woche und die Jagd nach Entdeckungen: Wörter,
> die seit sieben Tagen niemand mehr geschrieben hat.
>
> LASS DAS WÖRTERBUCH WACHSEN
> Ein Wort fehlt? Schlag es mit einem Tipp vor. Sobald drei Moderatoren es
> bestätigt haben, kommt es ins Wörterbuch, und du bekommst 150 XP.
>
> • Ohne Anmeldung: Ein Konto ist freiwillig (E-Mail oder Google)
> • Nur eine kurze Werbung, bei der Wahl einer neuen Kategorie
> • Allein auch offline spielbar
> • In sieben Sprachen, jede mit eigenem Wörterbuch: Deutsch, Englisch,
>   Französisch, Spanisch, Italienisch, Niederländisch, Portugiesisch
> • Live gespielte Musik und Klänge, helles und dunkles Design
> • Deine Daten lassen sich im Menü mit einem Tipp löschen

**App-Kategorie**: Spiel › Wörter
**Tags** (höchstens 5, aus der Liste der Play Console): Wörter, Quiz,
Allgemeinwissen, Einzelspieler, Mehrspieler
**Kontakt-E-Mail-Adresse**: fongue.jeremy@gmail.com (öffentlich im Eintrag)
**Datenschutzerklärung** (die Play Console nimmt nur eine Adresse für die
ganze App): https://jfongue.github.io/lettre-minute/confidentialite.html,
also `VITE_PRIVACY_URL` (Französisch); die deutsche Fassung liegt unter
https://jfongue.github.io/lettre-minute/confidentialite.de.html, und beide
Seiten verlinken aufeinander

## App-Inhalte (Play Console › Richtlinien › App-Inhalte)

| Abschnitt | Antwort |
| --- | --- |
| App-Zugriff | Keine Einschränkung: alles ist ohne Anmeldung zugänglich |
| Anzeigen | **Ja**: eine AdMob-Interstitial-Anzeige nach jeder Kategoriewahl ab der zweiten |
| Einstufung des Inhalts (IARC) | Kategorie „Spiel“; Nein bei allen Fragen (Gewalt, Angst, Sexualität, Glücksspiel, Sprache, Drogen, digitale Käufe); **Nutzer interagieren: Ja** (Spielername, Avatar und Punktzahlen sind in den Ranglisten, unter Freunden und in Duellen sichtbar; kein Chat, außer dem Namen wird kein freier Text ausgetauscht). Erwartetes Ergebnis: PEGI 3 / USK ab 0, mit dem Hinweis „Nutzer interagieren“ |
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
- Möglichkeit, die Löschung zu beantragen: **ja**, in der App (Menü › Profil ›
  Meine Daten löschen) und unter
  https://jfongue.github.io/lettre-minute/confidentialite.de.html#effacer
  (auf Französisch: `VITE_PRIVACY_URL#effacer`)

| Datentyp (Play) | Was es hier ist | Erhoben | Weitergegeben | Kurzzeitige Verarbeitung | Erforderlich | Zweck |
| --- | --- | --- | --- | --- | --- | --- |
| Personenbezogene Daten › Nutzer-IDs | Die anonyme Supabase-Kennung | Ja | Nein | Nein | Ja | App-Funktionalität |
| Personenbezogene Daten › Name | Spielername, beim Erstellen des Kontos gewählt, für andere Spieler sichtbar | Ja | Nein | Nein | Nein (Konto freiwillig) | App-Funktionalität, Kontoverwaltung |
| Personenbezogene Daten › E-Mail-Adresse | Anmeldung und Code zum Zurücksetzen des Passworts (eingegeben oder von Google übermittelt) | Ja | Nein | Nein | Nein (Konto freiwillig) | App-Funktionalität, Kontoverwaltung |
| Personenbezogene Daten › Sonstige Informationen | Freundesliste, Duelle | Ja | Nein | Nein | Nein | App-Funktionalität |
| Geräte- oder andere IDs | Firebase-Benachrichtigungstoken (Duelle) | Ja | Nein | Nein | Nein (der Spieler erlaubt Benachrichtigungen) | App-Funktionalität |
| App-Aktivitäten › Sonstige Aktionen | Partien, Punktzahlen, gespielte Wörter, XP | Ja | Nein | Nein | Ja | App-Funktionalität |
| App-Aktivitäten › Sonstige von Nutzern erstellte Inhalte | Für das Wörterbuch vorgeschlagene Wörter | Ja | Nein | Nein | Nein (der Spieler entscheidet sich für einen Vorschlag) | App-Funktionalität |
| Standort › Ungefährer Standort | Von AdMob aus der IP-Adresse abgeleitet | Ja | Ja | Nein | Ja | Werbung, Analysen, Betrugsprävention |
| Geräte- oder andere IDs | Werbe-ID (AdMob) | Ja | Ja | Nein | Ja | Werbung, Analysen, Betrugsprävention |
| App-Aktivitäten › App-Interaktionen | Einblendungen der Werbung und Tipps darauf (AdMob) | Ja | Ja | Nein | Ja | Werbung, Analysen, Betrugsprävention |
| App-Informationen und -Leistung › Diagnosedaten, Absturzprotokolle | Vom AdMob-SDK übermittelt | Ja | Ja | Nein | Ja | Analysen, Betrugsprävention |

Alles andere (genauer Standort, Kontakte, Fotos, Telefonnummer): **nicht
erhoben**. Das Passwort wird nur als Hash gespeichert, von Supabase Auth.

## Kontolöschung (Play Console › Richtlinien › Datenlöschung)

- Können Nutzer in der App ein Konto erstellen? **Ja**: Ein anonymes Konto
  wird automatisch erstellt, und der Spieler kann ihm einen Namen geben
  (Name, E-Mail, Passwort oder Google). Das Löschen entfernt das eine wie das andere
- Link zur Löschung außerhalb der App:
  https://jfongue.github.io/lettre-minute/confidentialite.de.html#effacer
  (die Play Console nimmt eine Adresse für alle Sprachen:
  `VITE_PRIVACY_URL#effacer`)
- Teilweise Löschung der Daten, ohne das Konto zu löschen: nicht angeboten
