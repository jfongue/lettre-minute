import type { ReactNode } from 'react'
import { sound } from '../lib/sound'

/*
 * La grammaire du Premium : un sceau jaune sur noir et des icônes de
 * ressource, toutes dans la même boîte 24×24 au même trait. Chaque icône a
 * sa variante pleine (`plus`) : la forme passe à l'encre, ses détails au
 * jaune. Rien ici ne se pose derrière un texte : tout se range à côté.
 */

interface IconProps {
  /** La variante Premium : forme pleine encre, détails jaunes. */
  plus?: boolean
  /** Côté en pixels ; la feuille de style donne 24 par défaut. */
  size?: number
  className?: string
}

function Icon({ plus, size, className = '', children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      className={`pi${plus ? ' pi--plus' : ''} ${className}`}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

/** Le cadenas : le filtrage des catégories. */
export function LockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path className="pi-detail" d="M8 11V8a4 4 0 0 1 8 0v3" />
      <rect className="pi-body" x="5" y="11" width="14" height="10" rx="1.5" />
      <circle className="pi-dot" cx="12" cy="16" r="1.6" />
    </Icon>
  )
}

/** L'œil : une amande épaisse, un iris, une pupille — la révélation. */
export function EyeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path className="pi-body pi-almond" d="M1.8 12Q12 3 22.2 12Q12 21 1.8 12Z" />
      <circle className="pi-iris" cx="12" cy="12" r="4.3" />
      <circle className="pi-pupil" cx="12" cy="12" r="1.8" />
    </Icon>
  )
}

/** Le billet à encoches : une tentative au défi du moment. */
export function TicketIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        className="pi-body"
        d="M4 6h16a1 1 0 0 1 1 1v3a2 2 0 0 0 0 4v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a2 2 0 0 0 0-4V7a1 1 0 0 1 1-1Z"
      />
      <path className="pi-detail pi-dash" d="M14.5 8.5v7" />
    </Icon>
  )
}

/** Le cercle pointillé : un emplacement de pouvoir. */
export function SlotIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle className="pi-body pi-dash" cx="12" cy="12" r="8.5" />
      <circle className="pi-dot" cx="12" cy="12" r="2" />
    </Icon>
  )
}

/** L'étoile à quatre branches : une catégorie en avant-première. */
export function PremiereIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path className="pi-body" d="M12 2L14.7 9.3L22 12L14.7 14.7L12 22L9.3 14.7L2 12L9.3 9.3Z" />
      <circle className="pi-dot" cx="12" cy="12" r="1.7" />
    </Icon>
  )
}

/** Un cœur de deux arcs et d'une pointe : aider un petit développeur indé. */
export function HeartIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path className="pi-body" d="M12 20.5L3.6 12.2A4.7 4.7 0 0 1 12 7.2A4.7 4.7 0 0 1 20.4 12.2Z" />
      <circle className="pi-dot" cx="8.6" cy="11" r="1.4" />
    </Icon>
  )
}

/** Un carré barré : plus aucune pub. */
export function NoAdsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect className="pi-body" x="3.5" y="5" width="17" height="14" rx="1.5" />
      <path className="pi-detail" d="M6 18L18 6" />
    </Icon>
  )
}

/** Deux anneaux entrelacés, le ∞ du sceau, dessinés et non écrits. */
function InfinityRings({ className = '' }: { className?: string }) {
  return (
    <>
      <circle className={className} cx="8.4" cy="12" r="4.1" />
      <circle className={className} cx="15.6" cy="12" r="4.1" />
    </>
  )
}

/** Le ∞ seul, au trait jaune : le compteur d'une ressource que Premium libère. */
export function InfinityMark({ className = '' }: { className?: string }) {
  return (
    <svg className={`pinf ${className}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <InfinityRings />
    </svg>
  )
}

/** À vie : le ∞ en icône, à côté de son texte. */
export function ForeverIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <InfinityRings className="pi-detail pi-rings" />
    </Icon>
  )
}

export type ResourceIcon = 'lock' | 'eye' | 'ticket' | 'slot' | 'premiere' | 'heart' | 'noads' | 'forever'

const ICONS: Record<ResourceIcon, (props: IconProps) => ReactNode> = {
  lock: LockIcon,
  eye: EyeIcon,
  ticket: TicketIcon,
  slot: SlotIcon,
  premiere: PremiereIcon,
  heart: HeartIcon,
  noads: NoAdsIcon,
  forever: ForeverIcon,
}

export const RESOURCE_ICONS = Object.keys(ICONS) as readonly ResourceIcon[]

export function ResourceGlyph({ icon, ...props }: IconProps & { icon: ResourceIcon }) {
  return <>{ICONS[icon](props)}</>
}

/** Le sceau : un disque noir, deux anneaux jaunes. Se pose à côté d'un texte. */
export function PlusSeal({
  size = 'md',
  animated = false,
  className = '',
}: {
  size?: 'sm' | 'md' | 'lg'
  /** Entre par un pop et un seul reflet, une fois. */
  animated?: boolean
  className?: string
}) {
  return (
    <span className={`pseal pseal--${size}${animated ? ' pseal--enter' : ''} ${className}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false">
        <circle className="pseal-disc" cx="12" cy="12" r="12" />
        <InfinityRings className="pseal-ring" />
      </svg>
    </span>
  )
}

export type ResourceState = 'normal' | 'spent' | 'locked'

/**
 * Le compteur d'une ressource, le même partout : l'icône et un nombre
 * (« 2 », « 3/8 »), ou l'icône Premium et ∞ quand Premium l'a libérée.
 * « Épuisé » s'éteint ; « verrouillé » se pointille et porte le sceau.
 */
export function ResourceChip({
  icon,
  count,
  max,
  unlimited = false,
  state = 'normal',
  label,
}: {
  icon: ResourceIcon
  count?: number
  max?: number
  unlimited?: boolean
  state?: ResourceState
  /** Ce que lit un lecteur d'écran, puisque l'icône et le nombre sont muets. */
  label: string
}) {
  const plus = unlimited && state !== 'locked'
  return (
    <span className={`rchip rchip--${state}${plus ? ' rchip--plus' : ''}`} role="img" aria-label={label}>
      <ResourceGlyph icon={icon} plus={plus} />
      <span className="rchip-count" aria-hidden="true">
        {state === 'locked' ? (
          <PlusSeal size="sm" />
        ) : plus ? (
          <InfinityMark />
        ) : (
          <>
            {count}
            {max !== undefined && <span className="rchip-max">/{max}</span>}
          </>
        )}
      </span>
    </span>
  )
}

/**
 * Un emplacement qu'il faut Premium pour ouvrir : tentatives 4 et 5, catégories
 * en avant-première, révélations au-delà de la limite. Un contour jaune
 * pointillé, le sceau dans le flux, une tape ouvre la fiche.
 */
export function PlusLockedSlot({
  icon,
  label,
  hint,
  onOpen,
}: {
  icon: ResourceIcon
  label: string
  hint?: string
  onOpen(): void
}) {
  return (
    <button
      type="button"
      className="pslot"
      data-track="plus-locked-slot"
      onClick={() => {
        sound.plus()
        onOpen()
      }}
    >
      <ResourceGlyph icon={icon} className="pslot-icon" />
      <span className="pslot-text">
        <span className="pslot-label">{label}</span>
        {hint && <span className="pslot-hint">{hint}</span>}
      </span>
      <PlusSeal size="sm" />
    </button>
  )
}
