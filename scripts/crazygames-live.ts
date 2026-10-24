/**
 * Ce que le portail sert en ligne à l'instant : l'identifiant de son build et
 * le dossier de fichiers qu'il charge. Une mise à jour téléversée attend sa
 * revue, et jusque-là le joueur reçoit l'ancien build — le téléversement n'est
 * donc pas la publication, et « ça ne va toujours pas » se répond d'abord ici :
 * le build que le portail annonce est-il celui qu'on vient d'envoyer ?
 *
 * Le build publié dit aussi son commit sur le document (`data-build`,
 * src/crazygames.tsx) ; `npm run crazygames:live -- <buildId>` le vérifie, et
 * l'absence de l'attribut est la réponse pour tout build antérieur.
 *
 * npm run crazygames:live
 */
// La page du portail ne porte pas le détail ; c'est le cadre qu'elle charge
// (games.crazygames.com) qui annonce le build publié et ses fichiers.
const PAGE = 'https://games.crazygames.com/en_US/letter-minute/index.html'

const html = await (await fetch(PAGE, { headers: { 'user-agent': 'Mozilla/5.0 (Macintosh) lettre-minute' } })).text()
const buildId = /"buildId":"([^"]+)"/.exec(html)?.[1]
const files = /"loaderOptions":\{"url":"([^"]+)"/.exec(html)?.[1]

if (!buildId) {
  console.error('Le portail n’a pas répondu comme prévu : pas de buildId dans la page.')
  process.exit(1)
}

console.log(`en ligne : build ${buildId}`)
if (files) console.log(`fichiers : ${files}`)
console.log('Le portail ne publie qu’après revue : un build téléversé n’est en ligne qu’une fois celui-ci changé.')
