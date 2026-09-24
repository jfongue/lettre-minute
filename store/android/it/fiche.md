# Scheda Play Store — Lettera Minuto (italiano)

Testi e risposte da copiare in Play Console. Le immagini sono un livello più
su: `../icon-512.png`, `feature-graphic.png` (1024 × 500, in questa cartella),
`../screenshots/it/` (1080 × 1920, chiaro e scuro). Per rigenerarle:
`scripts/render-store.sh`.

## Scheda principale (italiano)

**Nome** (max 30 caratteri)
> Lettera Minuto

**Descrizione breve** (max 80 caratteri)
> Una lettera, una categoria, 60 secondi. Più la parola è rara, più punti vale.

**Descrizione completa** (max 4000 caratteri)

> Esce una lettera, compare una categoria, parte il cronometro. Paesi con la
> B, animali con la M, colori con la V… Hai sessanta secondi per scrivere più
> parole che puoi.
>
> Il gioco controlla ogni parola mentre scrivi, grazie a un dizionario di
> oltre 30.000 parole costruito su Wikidata e Wikizionario. «Gatti»
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
> SALI DI LIVELLO
> Ogni punto ti dà esperienza, e ogni livello sblocca una nuova categoria:
> frutta e verdura, mestieri, sport, parti del corpo, materiali, capitali,
> marchi…
>
> FAI CRESCERE IL DIZIONARIO
> Manca una parola? Proponila con un tocco. Quando la chiedono tre giocatori,
> entra nel dizionario e tu guadagni 150 XP.
>
> • Nessuna registrazione
> • Una sola pubblicità, breve, alla scelta di una nuova categoria
> • Si gioca offline
> • Tema chiaro e scuro
> • I tuoi dati si cancellano con un gesto dalla schermata iniziale

**Categoria dell’app**: Gioco › Parole
**Tag**: Parole, Quiz, Giocatore singolo, Cultura generale
**Indirizzo e-mail di contatto**: da inserire (pubblico nella scheda)
**Norme sulla privacy**: l’indirizzo pubblico di
`store/privacy/confidentialite.it.html` una volta pubblicata (oggi
`VITE_PRIVACY_URL` è la pagina francese)

## Contenuti dell’app (Play Console › Norme › Contenuti dell’app)

| Sezione | Risposta |
| --- | --- |
| Accesso all’app | Nessuna restrizione: tutto è accessibile senza accedere |
| Annunci | **Sì**: un interstitial AdMob dopo ogni scelta di categoria a partire dalla seconda |
| Classificazione dei contenuti (IARC) | Categoria «Gioco»; no a tutte le domande (violenza, paura, sessualità, gioco d’azzardo, linguaggio, droghe, acquisti digitali); i giocatori non si scambiano messaggi e non condividono nulla tra loro. Risultato atteso: PEGI 3 / Per tutti |
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
- Modo per richiedere l’eliminazione: **sì**, nell’app (home › Cancella i
  miei dati) e all’indirizzo `VITE_PRIVACY_URL#effacer`

| Tipo di dati (Play) | Cos’è qui | Raccolti | Condivisi | Trattamento temporaneo | Obbligatorio | Finalità |
| --- | --- | --- | --- | --- | --- | --- |
| Informazioni personali › ID utente | L’identificativo anonimo Supabase | Sì | No | No | Sì | Funzionalità dell’app |
| Attività nelle app › Altre azioni | Partite, punteggi, parole giocate, XP | Sì | No | No | Sì | Funzionalità dell’app |
| Attività nelle app › Altri contenuti generati dagli utenti | Parole proposte per il dizionario | Sì | No | No | No (il giocatore sceglie di proporre) | Funzionalità dell’app |
| Posizione › Posizione approssimativa | Dedotta da AdMob dall’indirizzo IP | Sì | Sì | No | Sì | Pubblicità, analisi, prevenzione delle frodi |
| Dispositivo o altri ID | ID pubblicità (AdMob) | Sì | Sì | No | Sì | Pubblicità, analisi, prevenzione delle frodi |
| Attività nelle app › Interazioni con l’app | Visualizzazioni e tocchi sulla pubblicità (AdMob) | Sì | Sì | No | Sì | Pubblicità, analisi, prevenzione delle frodi |
| Informazioni e prestazioni dell’app › Diagnostica, Log degli arresti anomali | Inviati dall’SDK AdMob | Sì | Sì | No | Sì | Analisi, prevenzione delle frodi |

Tutto il resto (posizione precisa, contatti, foto, e-mail, nome): **non
raccolto**.

## Eliminazione dell’account (Play Console › Norme › Eliminazione dei dati)

- L’app consente di creare un account? **Sì**, un account anonimo viene
  creato automaticamente
- Link per l’eliminazione fuori dall’app: `VITE_PRIVACY_URL#effacer`
- Eliminazione parziale dei dati senza eliminare l’account: non offerta
