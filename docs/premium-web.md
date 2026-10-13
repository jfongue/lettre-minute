# Premium payant sur le web : marche à suivre

Le code est prêt : la page web ouvre le paiement du marchand
(`premium-checkout`), le marchand rappelle le serveur (`premium-webhook`), et
l'achat se range dans `purchases` (0069) sous le compte du joueur. Rien ne
facture tant que les secrets et `VITE_PREMIUM_WEB` ne sont pas posés : sans
eux, la feuille Premium reste celle du téléphone et le web garde le Premium
gratuit actuel.

Le marchand retenu est **Lemon Squeezy** : il vend en son nom propre, donc la
TVA de l'Union, les factures et l'OSS des ventes à l'étranger sont à sa
charge, pas à la tienne. Paddle rend le même service ; ce qui suit se
transpose à son API, pas au code écrit ici.

## 1. Le compte marchand et le produit

1. Créer un compte sur https://app.lemonsqueezy.com (compte développeur
   personnel, la même adresse de contact que le jeu : fongue.jeremy@gmail.com).
2. **Store** : « Lettre Minute ». Renseigner les mentions légales du vendeur
   (nom, adresse, TVA le cas échéant) : le marchand les exige pour valider le
   compte.
3. **Product > New product** : « Premium à vie », type **pas** un abonnement.
   - Prix : **2,50 €** (ou la devise de base du store), un seul paiement.
   - Un seul **variant** sous ce produit, nommé « Premium à vie ».
   - Cocher la variante comme active ; relever son **ID** et celui du store
     (visibles dans l'URL de l'admin, `…/stores/<store id>/products/<product
     id>?variant=<variant id>`).
4. **Checkout** : dans les réglages du produit, garder la redirection du code
   (`?premium=paid` sur l'adresse du jeu), ou poser une autre adresse dans
   `PREMIUM_REDIRECT_URL`. Les conditions de vente et la politique de
   remboursement doivent être publiées sur une page publique avant la
   validation du compte : `public/confidentialite.html` existe, il manque des
   CGU et une mention de remboursement (voir « Ce qui reste à faire »).

## 2. Les secrets Supabase

```
export SUPABASE_HOME="$PWD/.cache/supabase-home"
supabase secrets set --project-ref <ref> \
  LEMONSQUEEZY_API_KEY="<clé API>" \
  LEMONSQUEEZY_STORE_ID="<store id>" \
  LEMONSQUEEZY_VARIANT_ID="<variant id>" \
  LEMONSQUEEZY_WEBHOOK_SECRET="<secret du webhook>" \
  PREMIUM_REDIRECT_URL="https://jfongue.github.io/lettre-minute/?premium=paid"
```

La clé API se crée dans **Settings > API** ; le secret du webhook est choisi à
l'étape 4 et recopié ici à l'identique.

## 3. Base et fonctions (rien n'est appliqué)

```
supabase db push --linked --dry-run   # doit lister 0069
supabase db push --linked --yes
supabase functions deploy premium-checkout
supabase functions deploy premium-webhook --no-verify-jwt
```

`premium-webhook` se déploie **sans vérification de JWT** : le marchand n'a pas
de session à présenter, et c'est la signature qui garde la porte. Le déployer
avec la vérification par défaut ferait refuser chaque commande.

## 4. Le webhook

Lemon Squeezy > **Settings > Webhooks > Add webhook** :

- URL : `https://<ref>.supabase.co/functions/v1/premium-webhook`
- Signing secret : une chaîne au hasard, reportée dans
  `LEMONSQUEEZY_WEBHOOK_SECRET` (étape 2).
- Événements : `order_created` et `order_refunded` seulement.

Un remboursement refusé par la carte, une commande impayée ou une commande
sans nos données (`custom.account`) ne sont pas comptés : la première reste
`pending` ou `refused`, les autres sont ignorées.

## 5. Le build web

Ajouter à `.env.local` :

```
VITE_PREMIUM_WEB=true
```

Sans elle, `premiumStoreOpen` reste faux sur le web et rien ne change pour les
joueurs. Le bouton dit alors « Passer Premium — 2,50 € » (le prix de repli de
l'i18n, dans la langue du joueur), ouvre la page du marchand dans l'onglet
courant, et le joueur revient à `?premium=paid` : le retour interroge
`my_premium` quelques secondes, le temps que le webhook arrive.

Un achat web demande un compte **connecté** : l'ordre porte l'identifiant du
compte, et c'est ce qui permet de retrouver Premium sur le téléphone. Sans
session, le bouton répond « erreur » et rien n'est facturé.

## 6. Ce qui reste à faire

- Les **CGU et la politique de remboursement**, publiques et liées depuis la
  feuille Premium et le site : Lemon Squeezy refuse un compte sans elles.
- Une page de vente publique : la version web actuelle est un canal de debug.
- Vérifier de bout en bout avec un achat réel à 1 € sur un compte de test,
  puis rembourser : le remboursement doit retirer Premium au prochain
  démarrage (`my_premium`), pas l'annuler rétroactivement sur l'appareil.
- Le même produit sur Play (2,50 €, `store/android/premium.md`) : deux prix,
  deux marchands, un seul `premium_lifetime` en base.
