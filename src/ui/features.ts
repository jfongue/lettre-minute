import { createContext, useContext } from 'react'
import { ALL_FEATURES, type FeatureId } from '../domain/features'

/**
 * Les fonctionnalités ouvertes au joueur, telles que l'app les a lues au
 * démarrage (`enabledFeatures`). Sans fournisseur — la planche debug, une page
 * à part —, tout est ouvert : chaque écran se montre en entier.
 */
export const FeaturesContext = createContext<ReadonlySet<string>>(ALL_FEATURES)

export function useFeature(id: FeatureId): boolean {
  return useContext(FeaturesContext).has(id)
}
