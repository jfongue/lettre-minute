# Notifications push

Les défis préviennent le téléphone, app fermée : une invitation reçue, un
bilan prêt. Android seulement pour l'instant.

## Comment ça circule

1. La base écrit ce qu'il faut envoyer dans `push_outbox` (migration
   [`0009_push.sql`](../supabase/migrations/0009_push.sql)) : un invité
   ajouté à un défi, la dernière partie jouée, ou un défi échu (pg_cron,
   chaque minute).
2. Elle réveille la fonction Edge [`push`](../supabase/functions/push/index.ts)
   par pg_net, avec le secret `x-push-secret` qu'elle a tiré elle-même
   (`push_config`, migration 0010).
3. La fonction lit la file (`claim_push_batch`), écrit chaque message dans la
   langue du téléphone, l'envoie par FCM, efface les jetons morts et marque
   ce qui est parti (`finish_push_batch`).
4. Dans l'app, `src/lib/native.ts` demande la permission, inscrit le jeton
   (`save_push_token`) et ouvre le défi quand on touche la notification.

Sans secrets, sans fonction déployée ou sans Firebase dans le build, rien ne
casse : la file attend, et les défis se découvrent à l'accueil comme avant.

## Mise en place, une fois

### 1. Firebase

1. [console.firebase.google.com](https://console.firebase.google.com) →
   créer un projet (Analytics inutile).
2. Ajouter une app **Android**, nom de package `fr.lettreminute.app`.
3. Télécharger `google-services.json` et le poser dans `android/app/`. Le
   Gradle ne l'applique que s'il existe ; il est ignoré par git.
4. Paramètres du projet → **Comptes de service** → *Générer une nouvelle clé
   privée* : un fichier JSON. Il ne va **jamais** dans le dépôt.

### 2. Supabase

La fonction Edge, déployée sans vérification de jeton utilisateur (c'est la
base qui l'appelle), et la clé du compte de service en secret :

```bash
supabase functions deploy push --no-verify-jwt --use-api
```

```bash
supabase secrets set FCM_SERVICE_ACCOUNT="$(cat chemin/vers/cle-service.json)"
```

Les migrations (0009 et 0010) :

```bash
supabase db push
```

Rien à écrire dans le Vault : la base tire elle-même le secret partagé
(`push_secret`, migration 0010), et la fonction y inscrit sa propre adresse
(`push_url`) à chaque appel. Un premier appel suffit à l'amorcer ; il répond
403, c'est normal :

```bash
curl -X POST https://<ref>.supabase.co/functions/v1/push
```

### 3. Le build

Dans `.env.local` : `VITE_PUSH_ENABLED=true`, puis `npm run android:sync`.
Sans `google-services.json`, laisser le drapeau vide : l'inscription au push
ferait planter l'app au lancement.

### 4. Play Console

Formulaire *Sécurité des données* : déclarer « Identifiants de l'appareil ou
autres » (le jeton FCM), collectés pour le fonctionnement de l'app, non
partagés. La politique de confidentialité le mentionne déjà.

## Vérifier

- `select * from push_outbox order by id desc limit 20;` : `sent_at` rempli,
  `attempts` à 1.
- Tableau de bord Supabase → Edge Functions → `push` → journaux.
- `select * from cron.job_run_details order by start_time desc limit 5;`
  pour la passe de chaque minute.
