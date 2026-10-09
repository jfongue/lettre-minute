# Premium et pubs récompensées : marche à suivre

Le code est prêt (`src/lib/billing.ts`, `src/lib/native.ts`, 0063, fonction
`premium-verify`). Rien ne fonctionne en vrai tant que les étapes ci-dessous ne
sont pas faites, dans cet ordre.

## 1. Le produit dans la Play Console

Play Console (compte `/u/1/`), app 4975182793225983707 :
**Monétiser avec Play > Produits > Produits in-app > Créer un produit**.

- ID du produit : `premium_lifetime` (exactement ; il ne se renomme jamais).
- Nom : « Premium à vie » ; description : « Un seul paiement, pour toujours :
  filtrage de 6 catégories, révélations illimitées, 5 tentatives par jour au
  défi du moment, catégories en avant-première, plus aucune pub. »
- Produit **non consommable** (c'est le cas d'un produit in-app à achat unique
  sans consommation : le code ne le consomme jamais, seulement l'accuse).
- Prix de base : **2,50 € (EUR)**, puis « Modifier les prix » pour les autres
  pays. La console propose une conversion automatique ; écrase les devises
  principales par des prix ronds (propositions, à ajuster à la conversion du
  jour) :

  | Devise | Prix proposé | Devise | Prix proposé |
  |---|---|---|---|
  | EUR | 2,50 € | CHF | 2,50 CHF |
  | USD | 2,99 $ | CAD | 3,99 $ |
  | GBP | 2,49 £ | AUD | 3,99 $ |
  | BRL | 14,90 R$ | MXN | 49 $ |
  | PLN | 10,99 zł | SEK | 29 kr |
  | NOK | 29 kr | DKK | 19 kr |
  | JPY | 400 ¥ | INR | 199 ₹ |

  Pour une devise absente, garde la conversion de Google et arrondis au prix
  « charme » le plus proche (x,99 / x,49).
- **Activer** le produit. Il doit être actif et l'app (piste alpha au moins)
  publiée avec la permission de facturation (déjà dans le manifeste) avant que
  `getProduct` réponde ; le prix affiché dans l'app est celui du store, dans la
  devise du joueur.
- Tests : **Paramètres > Test de licence** : ajoute les Gmail des testeurs
  (achats gratuits, remboursés d'office). Installer l'app depuis la piste de
  test, jamais depuis un APK local.

## 2. Compte de service pour la vérification serveur (optionnel mais conseillé)

Sans lui, un achat est enregistré `unverified` (il compte quand même).

1. Google Cloud, projet « LettreMinute » (222920504485) : activer l'API
   **Google Play Android Developer API**.
2. IAM > Comptes de service > créer `premium-verify` (aucun rôle projet) >
   Clés > Ajouter une clé > JSON. Garde le fichier hors du dépôt.
3. Play Console > **Utilisateurs et autorisations > Inviter** l'e-mail du compte
   de service, avec la permission **Afficher les informations financières** et
   **Gérer les commandes et abonnements** sur l'app. Compte plusieurs heures de
   propagation.
4. Le secret : `supabase secrets set --project-ref <ref> PLAY_SERVICE_ACCOUNT="$(cat clé.json)"`
   (avec `SUPABASE_HOME="$PWD/.cache/supabase-home"`, voir `CLAUDE.local.md`).

## 3. Côté Supabase (à faire, rien n'est appliqué)

```
supabase db push --linked --dry-run      # doit lister 0062 (défi du moment) puis 0063
supabase db push --linked --yes
supabase functions deploy premium-verify  # JWT vérifié (défaut) : l'app envoie sa session
```

## 4. Pubs récompensées (AdMob)

1. AdMob > Applications > Lettre Minute > **Blocs d'annonces > Ajouter > Avec
   récompense**. Nom : « Récompense » ; récompense : 1 « bonus » (la valeur est
   ignorée, le jeu décide ce qu'elle rapporte).
2. Copie l'ID du bloc (`ca-app-pub-XXXX/YYYY`) dans `.env.local` :
   `VITE_ADMOB_REWARDED_ID=ca-app-pub-XXXX/YYYY`.
   Sans cette variable, le build sert l'identifiant de test de Google (jamais de
   revenu, jamais de risque) ; ne jamais cliquer sur les vraies pubs depuis son
   propre téléphone.
3. Les interstitiels restent éteints (`ADS_ENABLED`) ; seul le consentement UMP
   existant sert aussi aux pubs récompensées.

## 5. Avant la livraison Android

```
npm install            # le plugin @capgo/native-purchases est dans package.json
npx cap sync android   # ajoute le module de facturation à android/ ; pas lancé ici
```

Ensuite `npm run android:release` comme d'habitude. Aucune capture ni note de
version ne doit citer le web.
