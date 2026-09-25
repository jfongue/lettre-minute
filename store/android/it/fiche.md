# Scheda Play Store — Lettera Minuto (italiano)

Testi e risposte da copiare in Play Console. Le immagini: `../icon-512.png`,
`feature-graphic.png` (1024 × 500, in questa cartella), `../listing/it/` (gli
otto screenshot con didascalia da caricare, 1080 × 1920) e `../screenshots/it/`
(le catture grezze da cui sono ricavati). Per rigenerarle:
`scripts/render-store.sh`.

## Scheda principale (italiano)

**Nome** (max 30 caratteri)
> Lettera Minuto

**Descrizione breve** (max 80 caratteri)
> Una lettera, una categoria, 60 secondi. Più la parola è rara, più punti vale.

**Descrizione completa** (max 4000 caratteri)

> Esce una lettera, compare una categoria, parte il cronometro. Paesi con la
> B, animali con la M, colori con la V… Hai sessanta secondi per scrivere più
> parole che puoi, e quelle che non trova nessuno valgono di più.
>
> Il gioco controlla ogni parola mentre scrivi, grazie a un dizionario di
> oltre 30.000 parole italiane costruito su Wikidata e Wikizionario. «Gatti»
> vale come «gatto», e un errore di battitura passa: «Germnaia» vale come
> «Germania».
>
> LE PAROLE RARE VALGONO DI PIÙ
> Una parola che scrivono tutti vale 10 punti. Una parola che non trova
> nessuno vale fino al triplo. E il bonus si consuma se tiri fuori la stessa
> parola a ogni partita: bisogna variare.
>
> NON FERMARTI
> Ogni parola convalidata di fila aumenta il moltiplicatore, fino a ×2.
> Saltare costa cinque secondi e azzera la serie.
>
> SFIDA I TUOI AMICI
> Fino a otto giocatori sulla stessa partita: stesse lettere, stesse
> categorie, ognuno quando vuole entro 24 ore. Mentre giochi, i punteggi di
> chi è passato prima di te avanzano come in diretta. Alla fine vale la regola
> di Nomi, cose, città: una parola trovata anche da un altro vale la metà.
> Classifica, trofei e, se ti va, la rivincita.
>
> DIECI POTERI
> Scrivi «zitto» e il cronometro si ferma. Scrivi «Joker» e il gioco trova una
> parola al posto tuo. Cambia lettera, scopri in anticipo la categoria
> successiva, fatti perdonare due errori… Un nuovo potere ogni due livelli, e
> due da portare in ogni partita.
>
> SALI DI LIVELLO
> Ogni punto ti dà esperienza, e a ogni livello ti vengono proposte tre nuove
> categorie, di cui ne tieni una: frutta e verdura, mestieri, sport, parti del
> corpo, materiali, capitali, marchi… Lungo la strada, quaranta avatar animati e
> trenta colori da sbloccare.
>
> SCALA LA CLASSIFICA
> Miglior partita del giorno, della settimana, e caccia alle scoperte: le
> parole che nessuno aveva scritto da sette giorni.
>
> FAI CRESCERE IL DIZIONARIO
> Manca una parola? Proponila con un tocco. Se tre moderatori la approvano,
> entra nel dizionario e tu guadagni 150 XP.
>
> • Nessuna registrazione: l’account è facoltativo (e-mail o Google)
> • Una sola pubblicità, breve, alla scelta di una nuova categoria
> • Si gioca offline in singolo
> • In sette lingue, ognuna con il suo dizionario: francese, inglese,
>   spagnolo, tedesco, italiano, olandese, portoghese
> • Musica e suoni generati dal vivo, tema chiaro e scuro
> • I tuoi dati si cancellano con un gesto dal menu

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
| Annunci | **Sì**: un interstitial AdMob dopo ogni scelta di categoria a partire dalla seconda |
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
