# Scheda Play Store — Lettera Minuto (italiano)

Testi e risposte da copiare in Play Console. Le immagini: `../icon-512.png`,
`feature-graphic.png` (1024 × 500, in questa cartella), `../listing/it/` (i
cinque screenshot con didascalia da caricare, 1080 × 1920) e `../screenshots/it/`
(le catture grezze da cui sono ricavati). Per rigenerarle:
`scripts/render-store.sh`.

## Scheda principale (italiano)

**Nome** (max 30 caratteri)
> Lettera Minuto

**Descrizione breve** (max 80 caratteri)
> Nomi, cose, città in versione lampo: una lettera, 60 secondi. Sfida gli amici!

**Descrizione completa** (max 4000 caratteri)

> Nomi, cose, città in versione lampo. Esce una lettera, compare un tema,
> parte il cronometro: paesi con la B, animali con la M, mestieri con la P…
> Hai sessanta secondi per trovarne il più possibile.
>
> SFIDA I TUOI AMICI
> Invita fino a sette amici nella stessa partita: stesse lettere, stessi temi,
> ognuno gioca quando vuole. Classifica, trofei e rivincita.
>
> POTERI PER BARARE UN PO’
> Cambia lettera, scopri in anticipo il tema successivo, fatti perdonare due
> errori… Dieci poteri da conquistare: trova la tua combinazione preferita.
>
> NUOVI TEMI A OGNI LIVELLO
> Conquista nuovi temi per una sfida ancora più grande: frutta e verdura,
> mestieri, sport, parti del corpo, città, marchi…
>
> PER I PIÙ ACCANITI
> Le parole più rare valgono fino al triplo: vieni a scoprirle, o proponi le
> tue.
>
> • Nessuna registrazione, account facoltativo
> • Si gioca offline in singolo
> • In sette lingue

**Categoria dell’app**: Gioco › Parole
**Tag** (max 5, scelti dall’elenco di Play Console): Parole, Quiz, Cultura
generale, Giocatore singolo, Multiplayer
**Indirizzo e-mail di contatto**: fongue.jeremy@gmail.com (pubblico nella scheda)
**Norme sulla privacy** (un solo indirizzo per tutta l’app):
https://jfongue.github.io/lettre-minute/confidentialite.html, cioè
`VITE_PRIVACY_URL`; la traduzione italiana è
https://jfongue.github.io/lettre-minute/confidentialite.it.html, e le due
pagine si rimandano a vicenda

## Contenuti dell’app (Play Console › Norme › Contenuti dell’app)

| Sezione | Risposta |
| --- | --- |
| Accesso all’app | Nessuna restrizione: tutto è accessibile senza accedere |
| Annunci | **No**: la pubblicità è spenta (`ADS_ENABLED`). L’SDK AdMob resta nel build ma non parte mai; tornare a **Sì** quando la si riaccende |
| Classificazione dei contenuti (IARC) | Categoria «Gioco»; no a tutte le domande (violenza, paura, sessualità, gioco d’azzardo, linguaggio, droghe, acquisti digitali); **interazione tra utenti: sì** (nome del giocatore, avatar e punteggi visibili in classifica, tra amici e nelle sfide; nessuna messaggistica, nessun testo libero scambiato a parte il nome). Risultato atteso: PEGI 3 / Per tutti, con la dicitura «Interazione tra utenti» |
| Pubblico di destinazione | 13 anni e oltre. Scegliere una fascia sotto i 13 anni fa entrare l’app nel programma Famiglie e nei suoi requisiti aggiuntivi |
| App di notizie | No |
| App governative / sanitarie / finanziarie | No |
| ID pubblicità | **Sì**, tramite l’SDK AdMob; finalità: pubblicità, analisi, prevenzione delle frodi. L’autorizzazione `AD_ID` viene aggiunta al manifest dall’SDK |

## Sicurezza dei dati

Le righe Supabase valgono solo se la build include le sue chiavi; le righe
AdMob valgono per ogni build Android, perché l’SDK pubblicitario c’è sempre.
Le dichiarazioni AdMob riprendono la guida «Sicurezza dei dati» della Guida di
AdMob, da rileggere a ogni aggiornamento dell’SDK.

- Raccolta o condivisione di dati: **sì, raccolta** e **sì, condivisione**
  (con Google, per la pubblicità)
- Dati criptati in transito: **sì** (HTTPS verso Supabase e Google)
- Modo per richiedere l’eliminazione: **sì**, nell’app (Menu › Profilo ›
  Cancella i miei dati) e all’indirizzo
  https://jfongue.github.io/lettre-minute/confidentialite.it.html#effacer

| Tipo di dati (Play) | Cos’è qui | Raccolti | Condivisi | Trattamento temporaneo | Obbligatorio | Finalità |
| --- | --- | --- | --- | --- | --- | --- |
| Informazioni personali › ID utente | L’identificativo anonimo Supabase | Sì | No | No | Sì | Funzionalità dell’app |
| Informazioni personali › Nome | Nome del giocatore, scelto alla creazione dell’account, visibile agli altri giocatori | Sì | No | No | No (account facoltativo) | Funzionalità dell’app, gestione dell’account |
| Informazioni personali › Indirizzo email | Accesso e codice per reimpostare la password (inserito o trasmesso da Google) | Sì | No | No | No (account facoltativo) | Funzionalità dell’app, gestione dell’account |
| Informazioni personali › Altre informazioni | Elenco degli amici, sfide | Sì | No | No | No | Funzionalità dell’app |
| Dispositivo o altri ID | Token di notifica Firebase (sfide) | Sì | No | No | No (il giocatore accetta le notifiche) | Funzionalità dell’app |
| Attività nelle app › Altre azioni | Partite, punteggi, parole giocate, XP | Sì | No | No | Sì | Funzionalità dell’app |
| Attività nelle app › Altri contenuti generati dagli utenti | Parole proposte per il dizionario | Sì | No | No | No (il giocatore sceglie di proporre) | Funzionalità dell’app |
| Posizione › Posizione approssimativa | Dedotta da AdMob dall’indirizzo IP | Sì | Sì | No | Sì | Pubblicità, analisi, prevenzione delle frodi |
| Dispositivo o altri ID | ID pubblicità (AdMob) | Sì | Sì | No | Sì | Pubblicità, analisi, prevenzione delle frodi |
| Attività nelle app › Interazioni con l’app | Visualizzazioni e tocchi sulla pubblicità (AdMob) | Sì | Sì | No | Sì | Pubblicità, analisi, prevenzione delle frodi |
| Informazioni e prestazioni dell’app › Diagnostica, Log degli arresti anomali | Inviati dall’SDK AdMob | Sì | Sì | No | Sì | Analisi, prevenzione delle frodi |

Tutto il resto (posizione precisa, contatti, foto, numero di telefono): **non
raccolto**. La password è conservata solo in forma hash, da Supabase Auth.

## Eliminazione dell’account (Play Console › Norme › Eliminazione dei dati)

- L’app consente di creare un account? **Sì**: un account anonimo viene
  creato automaticamente, e il giocatore può dargli un nome (nome, e-mail,
  password, oppure Google). La cancellazione elimina l’uno come l’altro
- Link per l’eliminazione fuori dall’app:
  https://jfongue.github.io/lettre-minute/confidentialite.it.html#effacer
- Eliminazione parziale dei dati senza eliminare l’account: non offerta
