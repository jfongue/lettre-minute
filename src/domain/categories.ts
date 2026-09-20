export interface Category {
  id: string
  label: string
  /**
   * Letters this category cannot honestly be played with. A round is only fun
   * when every player believes an answer exists, so a category is pulled out of
   * the draw rather than left as a guaranteed blank.
   */
  unplayable?: readonly string[]
}

/**
 * The catalogue is a fixed, hand-ordered list: `shuffled` and `pickWeighted`
 * walk it in order, so the order is part of the seed. Sorting or re-ordering it
 * changes every match ever dealt from a given seed.
 */
export const CATEGORIES: readonly Category[] = [
  { id: 'prenoms-grands-parents', label: "Prénoms de grands-parents", unplayable: ['I', 'O', 'V'] },
  { id: 'metiers-uniforme', label: "Métiers en uniforme", unplayable: ['E', 'H', 'I', 'N', 'O', 'V'] },
  { id: 'choses-qui-fondent', label: "Choses qui fondent", unplayable: ['H', 'I', 'J', 'O'] },
  { id: 'villes-se-perdre', label: "Villes où l'on aimerait se perdre" },
  { id: 'instruments-musique', label: "Instruments de musique", unplayable: ['E', 'I', 'J', 'N', 'O'] },
  { id: 'objets-cave', label: "Ce qu'on trouve dans une cave", unplayable: ['H', 'I', 'J', 'N', 'O'] },
  { id: 'animaux-qui-font-peur', label: "Animaux qui font peur", unplayable: ['I', 'J', 'N', 'O'] },
  { id: 'plats-avec-les-doigts', label: "Plats qu'on mange avec les doigts", unplayable: ['E', 'I', 'J', 'N', 'O'] },
  { id: 'marques-voiture', label: "Marques de voiture", unplayable: ['E', 'I', 'N'] },
  { id: 'mots-du-bureau', label: "Mots qu'on entend au bureau" },
  { id: 'choses-qui-sentent-bon', label: "Choses qui sentent bon", unplayable: ['I', 'J', 'N'] },
  { id: 'fleuves-rivieres', label: "Fleuves et rivières", unplayable: ['F', 'J'] },
  { id: 'personnages-dessin-anime', label: "Personnages de dessin animé", unplayable: ['I'] },
  { id: 'salle-de-bain', label: "Objets d'une salle de bain", unplayable: ['H', 'I', 'J', 'N', 'O', 'V'] },
  { id: 'sports-plein-air', label: "Sports de plein air", unplayable: ['I', 'J', 'N', 'O'] },
  { id: 'choses-qu-on-perd', label: "Choses qu'on perd tout le temps", unplayable: ['I', 'J', 'N', 'O'] },
  { id: 'pays-europe', label: "Pays d'Europe", unplayable: ['J', 'O', 'V'] },
  { id: 'legumes', label: "Légumes du potager", unplayable: ['D', 'J', 'L', 'M', 'V'] },
  { id: 'choses-qui-piquent', label: "Choses qui piquent", unplayable: ['I', 'J', 'N', 'V'] },
  { id: 'outils-bricolage', label: "Outils de bricolage", unplayable: ['I', 'J', 'N', 'O'] },
  { id: 'capitales', label: "Capitales du monde", unplayable: ['F', 'J'] },
  { id: 'mots-doux', label: "Mots doux", unplayable: ['I', 'J', 'N', 'O', 'V'] },
  { id: 'films-revus', label: "Films qu'on a vus dix fois" },
  { id: 'oiseaux', label: "Oiseaux", unplayable: ['D', 'I', 'J', 'N', 'V'] },
  { id: 'parties-du-corps', label: "Parties du corps", unplayable: ['H', 'I', 'J', 'N', 'S', 'V'] },
  { id: 'choses-froides', label: "Choses froides", unplayable: ['I', 'J', 'O'] },
  { id: 'boissons-de-fete', label: "Boissons de fête", unplayable: ['E', 'I', 'N', 'O'] },
  { id: 'metiers-spectacle', label: "Métiers du spectacle", unplayable: ['E', 'H', 'I', 'N', 'O', 'V'] },
  { id: 'iles', label: "Îles", unplayable: ['E', 'F', 'J', 'O', 'V'] },
  { id: 'objets-grenier', label: "Objets d'un grenier", unplayable: ['I', 'J', 'N', 'O'] },
  { id: 'fromages', label: "Fromages", unplayable: ['H', 'I', 'J', 'N', 'O', 'V'] },
  { id: 'choses-qui-roulent', label: "Choses qui roulent", unplayable: ['I', 'J', 'N', 'O'] },
  { id: 'prenoms-de-chien', label: "Prénoms de chien" },
  { id: 'vetements-hiver', label: "Vêtements d'hiver", unplayable: ['H', 'I', 'J', 'N', 'O', 'V'] },
  { id: 'mots-d-argot', label: "Mots d'argot" },
  { id: 'dans-la-valise', label: "Ce qu'on met dans une valise", unplayable: ['I', 'J', 'N'] },
  { id: 'arbres', label: "Arbres", unplayable: ['D', 'I', 'J', 'N', 'V'] },
  { id: 'groupes-de-musique', label: "Groupes de musique" },
  { id: 'choses-qui-cassent', label: "Choses qui cassent", unplayable: ['I', 'J', 'N', 'O'] },
  { id: 'matieres-scolaires', label: "Matières scolaires", unplayable: ['I', 'J', 'N', 'O', 'V'] },
  { id: 'insectes', label: "Insectes", unplayable: ['D', 'E', 'I', 'J', 'N', 'O', 'V'] },
  { id: 'au-marche', label: "Ce qu'on achète au marché", unplayable: ['I', 'J', 'N'] },
  { id: 'metiers-de-la-mer', label: "Métiers de la mer", unplayable: ['E', 'H', 'I', 'J', 'N', 'O', 'V'] },
  { id: 'mots-qui-font-rire', label: "Mots qui font rire les enfants" },
  { id: 'choses-qu-on-empile', label: "Choses qu'on empile", unplayable: ['I', 'J', 'N', 'O'] },
  { id: 'series-tele', label: "Séries télé" },
  { id: 'desserts', label: "Desserts", unplayable: ['H', 'I', 'J', 'N', 'O'] },
  { id: 'choses-qu-on-repare', label: "Choses qu'on répare", unplayable: ['I', 'J', 'N', 'O'] },
  { id: 'montagnes', label: "Montagnes et massifs", unplayable: ['F', 'I', 'N', 'O'] },
  { id: 'objets-cuisine', label: "Objets d'une cuisine", unplayable: ['I', 'J', 'N', 'O'] },
  { id: 'raisons-d-etre-en-retard', label: "Raisons d'être en retard" },
  { id: 'choses-qu-on-collectionne', label: "Choses qu'on collectionne", unplayable: ['I', 'J', 'N', 'O'] },
  { id: 'danses', label: "Danses", unplayable: ['E', 'I', 'N', 'O'] },
  { id: 'metiers-d-autrefois', label: "Métiers d'autrefois", unplayable: ['E', 'H', 'I', 'J', 'N', 'O', 'V'] },
  { id: 'choses-qui-brillent', label: "Choses qui brillent", unplayable: ['I', 'J', 'N', 'O'] },
  { id: 'poissons-fruits-de-mer', label: "Poissons et fruits de mer", unplayable: ['I', 'J', 'N', 'V'] },
  { id: 'mots-tres-longs', label: "Mots de plus de dix lettres" },
  { id: 'dimanche', label: "Ce qu'on fait le dimanche", unplayable: ['I', 'J', 'N', 'O'] },
  { id: 'marques-de-vetements', label: "Marques de vêtements", unplayable: ['I', 'J', 'O'] },
  { id: 'emprunts-jamais-rendus', label: "Ce qu'on emprunte et qu'on ne rend pas", unplayable: ['I', 'J', 'N', 'O'] },
  { id: 'fruits', label: "Fruits", unplayable: ['E', 'H', 'I', 'J', 'N', 'S', 'V'] },
  { id: 'pieces-de-la-maison', label: "Pièces de la maison", unplayable: ['E', 'F', 'H', 'I', 'J', 'N', 'O', 'T', 'V'] },
  { id: 'depuis-le-train', label: "Ce qu'on voit depuis un train", unplayable: ['I', 'J', 'N'] },
  { id: 'metiers-de-reve', label: "Métiers de rêve", unplayable: ['E', 'H', 'I', 'N', 'O', 'V'] },
  { id: 'choses-qui-font-du-bruit', label: "Choses qui font du bruit", unplayable: ['I', 'J', 'N', 'O'] },
  { id: 'au-fond-du-sac', label: "Ce qu'il y a au fond d'un sac", unplayable: ['I', 'J', 'N', 'O'] },
  { id: 'plats-d-hiver', label: "Plats d'hiver", unplayable: ['E', 'H', 'I', 'J', 'N', 'O', 'V'] },
  { id: 'choses-interdites-en-avion', label: "Choses interdites en avion", unplayable: ['I', 'J', 'N', 'O'] },
  { id: 'heros-d-enfance', label: "Héros d'enfance" },
  { id: 'choses-qu-on-offre', label: "Ce qu'on offre quand on n'a pas d'idée", unplayable: ['I', 'J', 'N', 'O'] },
]

export function categoriesForLetter(letter: string, catalogue: readonly Category[] = CATEGORIES): Category[] {
  return catalogue.filter((category) => !category.unplayable?.includes(letter))
}
