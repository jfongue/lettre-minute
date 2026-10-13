import type { CSSProperties, ReactNode } from 'react'
import type { DetailKind, ShapeKind } from './motifs'

export const PATHS: Record<ShapeKind | DetailKind, ReactNode> = {
  circle: <circle cx="50" cy="50" r="50" />,
  square: <rect width="100" height="100" />,
  quarter: <path d="M0 0H100A100 100 0 0 1 0 100Z" />,
  arch: <path d="M0 100V50A50 50 0 0 1 100 50V100Z" />,
  half: <path d="M0 50A50 50 0 0 0 100 50Z" />,
  triangle: <path d="M50 0L100 100H0Z" />,
  corner: <path d="M0 0L100 100H0Z" />,
  ring: <circle cx="50" cy="50" r="36" fill="none" stroke="currentColor" strokeWidth="28" />,
  diamond: <path d="M50 0L100 50L50 100L0 50Z" />,
  bars: (
    <>
      <rect y="0" width="100" height="20" />
      <rect y="40" width="100" height="20" />
      <rect y="80" width="100" height="20" />
    </>
  ),
  cross: <path d="M35 0H65V35H100V65H65V100H35V65H0V35H35Z" />,
  lens: <path d="M50 0A62 62 0 0 1 50 100A62 62 0 0 1 50 0Z" />,
  moon: <path d="M62 2A50 50 0 1 0 62 98A40 48 0 0 1 62 2Z" />,
  pill: <rect x="20" width="60" height="100" rx="30" />,
  hexagon: <path d="M25 6H75L100 50L75 94H25L0 50Z" />,
  // La marche hisse la tuile de 18 % : le bas de l'escalier descend donc sous
  // le cadre, où il est coupé au repos et d'où il remonte pendant l'animation.
  // Sans ce débord, la dernière barre laisserait voir le fond.
  steps: <path d="M0 120V67H33V33H67V0H100V120Z" />,
  wave: <path d="M0 38Q25 8 50 38T100 38V68Q75 98 50 68T0 68Z" />,
  zigzag: <path d="M0 25L25 50L50 25L75 50L100 25V60L75 85L50 60L25 85L0 60Z" />,
  chevron: <path d="M0 15L50 55L100 15V50L50 90L0 50Z" />,
  hourglass: <path d="M0 0H100L50 50L100 100H0L50 50Z" />,
  flower: (
    <>
      <circle cx="30" cy="30" r="28" />
      <circle cx="70" cy="30" r="28" />
      <circle cx="30" cy="70" r="28" />
      <circle cx="70" cy="70" r="28" />
    </>
  ),
  dots: (
    <>
      {[18, 50, 82].flatMap((cy) => [18, 50, 82].map((cx) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="13" />))}
    </>
  ),
  checker: (
    <>
      <rect width="50" height="50" />
      <rect x="50" y="50" width="50" height="50" />
    </>
  ),
  star: <path d="M50 0L62 36H100L69 58L81 95L50 72L19 95L31 58L0 36H38Z" />,
  drop: <path d="M50 0C62 22 88 44 88 64A38 38 0 0 1 12 64C12 44 38 22 50 0Z" />,
  frame: <path fillRule="evenodd" d="M0 0H100V100H0Z M24 24V76H76V24Z" />,
  target: <path fillRule="evenodd" d="M50 0A50 50 0 1 1 50 100A50 50 0 1 1 50 0Z M50 18A32 32 0 1 0 50 82A32 32 0 1 0 50 18Z M50 36A14 14 0 1 1 50 64A14 14 0 1 1 50 36Z" />,
  heart: <path d="M50 92L9 52A24 24 0 0 1 50 18A24 24 0 0 1 91 52Z" />,
  domes: <path d="M0 50A50 50 0 0 1 100 50Z M0 100A50 50 0 0 1 100 100Z" />,
  sun: (
    <>
      <circle cx="50" cy="50" r="20" />
      <g stroke="currentColor" strokeWidth="5" strokeLinecap="round">
        {Array.from({ length: 12 }, (_, i) => (
          <line key={i} x1="50" y1="4" x2="50" y2="20" transform={`rotate(${i * 30} 50 50)`} />
        ))}
      </g>
    </>
  ),
  ringbroken: (
    <>
      <path d="M92.7 26.7A46 46 0 0 1 26.7 92.7" fill="none" stroke="currentColor" strokeWidth="26" />
      <path d="M7.3 73.3A46 46 0 0 1 73.3 7.3" fill="none" stroke="currentColor" strokeWidth="26" />
    </>
  ),
  comma: <path d="M50 0A42 42 0 0 1 92 42C92 68 72 88 46 100C46 84 38 70 26 56C16 44 8 34 8 24A24 24 0 0 1 50 0Z" />,
  bang: <path d="M39 0H61L55 58H45Z" />,
  eclipse: <path fillRule="evenodd" d="M50 0A50 50 0 1 1 50 100A50 50 0 1 1 50 0Z M50 0A50 50 0 0 0 50 100Z" />,
  bloom: (
    <>
      {[0, 72, 144, 216, 288].map((angle) => (
        <circle key={angle} cx="50" cy="23" r="19" transform={`rotate(${angle} 50 50)`} />
      ))}
    </>
  ),
  archway: <path d="M0 52A52 52 0 0 1 100 52V100H66V80A16 16 0 0 0 34 80V100H0Z" />,
  dial: <circle cx="50" cy="50" r="40" />,
// Les trois tuiles qu'un exploit ouvre sans barreau : le 6 de « Trois six », la
// carte de biais de « Juste arbitre », le faisceau de lignes de « Marathon ».
six: (
  <path
    d="M74 10A42 42 0 0 0 28 62A26 26 0 1 0 54 36"
    fill="none"
    stroke="currentColor"
    strokeWidth="18"
  />
),
card: <rect x="24" y="9" width="52" height="82" transform="rotate(-20 50 50)" />,
ribbon: (
  <g fill="none" stroke="currentColor" strokeWidth="10">
    <path d="M0 40H50A10 10 0 0 1 50 60H0" />
    <path d="M0 24H50A26 26 0 0 1 50 76H0" />
    <path d="M0 8H50A42 42 0 0 1 50 92H0" />
  </g>
),
  // Les figures relevées sur la planche bauhaus de Jérémy. Chacune ne répond
// qu'à une idée, et la grille y prend de quoi donner une tuile par barreau
// sans qu'aucune ne revienne : les montées s'empilent, les parties s'alignent,
// les mots trouvés se comptent, un score se marque, une série s'enchaîne.
stairs: (
<>
<rect y="66" width="34" height="34" />
<rect x="33" y="33" width="34" height="34" />
<rect x="66" width="34" height="34" />
</>
),
tents: (
<>
<path d="M50 4L76 44H24Z" />
<path d="M50 34L100 100H0Z" />
</>
),
gong: (
<>
<circle cx="50" cy="24" r="20" />
<path d="M0 100V78H28V56H72V78H100V100Z" />
</>
),
chevrons: (
<g fill="none" stroke="currentColor" strokeWidth="18">
<path d="M4 8L40 50L4 92" />
<path d="M36 8L72 50L36 92" />
<path d="M68 8L100 50L68 92" />
</g>
),
slats: (
<>
<ellipse cx="50" cy="10" rx="50" ry="11" />
<ellipse cx="50" cy="37" rx="50" ry="11" />
<ellipse cx="50" cy="64" rx="50" ry="11" />
<ellipse cx="50" cy="91" rx="50" ry="11" />
</>
),
barcode: (
<>
{[[2, 10], [16, 5], [25, 12], [41, 5], [50, 9], [63, 5], [72, 13], [89, 9]].map(([x, width]) => (
<rect key={x} x={x} width={width} height="100" />
))}
</>
),
// Les rayures s'allongent bien au-delà du cadre : le va-et-vient les tourne de
// sept degrés, et aucun bout de barre ne doit entrer dans la tuile.
stripes: (
<g transform="rotate(-45 50 50)">
{[-20, 12, 44, 76].map((y) => (
<rect key={y} x="-60" y={y} width="220" height="14" />
))}
</g>
),
stripedDisc: <path fillRule="evenodd" d="M50 0A50 50 0 1 1 50 100A50 50 0 1 1 50 0Z M8 26H92V35H8Z M8 46H92V55H8Z M8 66H92V75H8Z" />,
field: (
<>
{[16, 39, 62, 85].flatMap((cy) => [9, 25, 41, 57, 73, 89].map((cx) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="6" />))}
</>
),
grid: (
<>
{[10, 30, 50, 70, 90].map((v) => <rect key={`v${v}`} x={v - 2} width="4" height="100" />)}
{[10, 30, 50, 70, 90].map((h) => <rect key={`h${h}`} y={h - 2} width="100" height="4" />)}
</>
),
checker3: (
<>
<rect width="34" height="34" />
<rect x="66" width="34" height="34" />
<rect x="33" y="33" width="34" height="34" />
<rect y="66" width="34" height="34" />
<rect x="66" y="66" width="34" height="34" />
</>
),
diamonds: (
<>
<path d="M25 4L46 25L25 46L4 25Z" />
<path d="M75 4L96 25L75 46L54 25Z" />
<path d="M25 54L46 75L25 96L4 75Z" />
<path d="M75 54L96 75L75 96L54 75Z" />
</>
),
noise: (
<>
{Array.from({ length: 64 }, (_, index) => {
const x = index % 8
const y = Math.floor(index / 8)
return (x * 3 + y * 5) % 7 < 3 ? <rect key={index} x={x * 12.5} y={y * 12.5} width="12.5" height="12.5" /> : null
})}
</>
),
burst: <path fillRule="evenodd" d="M50 0A50 50 0 1 1 50 100A50 50 0 1 1 50 0Z M50 16Q57 43 84 50Q57 57 50 84Q43 57 16 50Q43 43 50 16Z" />,
threeQuarter: <path d="M50 0A50 50 0 1 0 100 50L50 50Z" />,
spark: <path d="M50 0Q60 40 100 50Q60 60 50 100Q40 60 0 50Q40 40 50 0Z" />,
eye: <path fillRule="evenodd" d="M0 50A62 62 0 0 1 100 50A62 62 0 0 1 0 50Z M50 28A22 22 0 1 1 50 72A22 22 0 1 1 50 28Z M50 39A11 11 0 1 1 50 61A11 11 0 1 1 50 39Z" />,
links: <path fill="none" stroke="currentColor" strokeWidth="15" d="M8 8H44A14 14 0 0 1 44 36H22A14 14 0 0 0 22 64H58A14 14 0 0 1 58 92H8" />,
pinwheel: (
<>
{[0, 90, 180, 270].map((angle) => (
<path key={angle} d="M50 50Q12 46 6 6Q46 12 50 50Z" transform={`rotate(${angle} 50 50)`} />
))}
</>
),
butterfly: (
<>
<path d="M0 0A50 50 0 0 1 0 100Z" />
<path d="M100 0A50 50 0 0 0 100 100Z" />
</>
),
twoMoons: (
<>
<path d="M62 2A50 50 0 1 0 62 98A40 48 0 0 1 62 2Z" transform="translate(8 5) scale(0.55 0.9)" />
<path d="M62 2A50 50 0 1 0 62 98A40 48 0 0 1 62 2Z" transform="translate(92 5) scale(-0.55 0.9)" />
</>
),
frameDiamond: <path fillRule="evenodd" d="M0 0H100V100H0Z M50 20L80 50L50 80L20 50Z" />,
roundedFrame: <path fillRule="evenodd" d="M20 0H80A20 20 0 0 1 100 20V80A20 20 0 0 1 80 100H20A20 20 0 0 1 0 80V20A20 20 0 0 1 20 0Z M36 28H64A8 8 0 0 1 72 36V64A8 8 0 0 1 64 72H36A8 8 0 0 1 28 64V36A8 8 0 0 1 36 28Z" />,
cushion: <path d="M0 0Q50 50 100 0Q50 50 100 100Q50 50 0 100Q50 50 0 0Z" />,
squareBite: <path fillRule="evenodd" d="M0 0H100V100H0Z M0 26A24 24 0 0 1 0 74Z" />,
// Les deux parts de la fente, chacune de son côté — `--way` dit lequel —, et la
// bande teintée s'écarte avec celle du haut. Ensemble, elles font le carré
// plein que `splitBand` fend en diagonale.
split: (
<>
<g className="avatar-piece" style={{ '--way': -1 } as CSSProperties}>
<path d="M0 0H62L0 62Z" />
</g>
<g className="avatar-piece" style={{ '--way': 1 } as CSSProperties}>
<path d="M100 38V100H38Z" />
</g>
</>
),
spiral: (
<path
d="M74 10A42 42 0 0 0 28 62A26 26 0 1 0 54 36"
fill="none"
stroke="currentColor"
strokeWidth="18"
/>
),
// Celles qu'aucun succès n'ouvre encore : la grille les garde en réserve,
// dessinées, pour le prochain barreau ou le prochain exploit.
rays: (
<g stroke="currentColor" strokeWidth="4">
{Array.from({ length: 16 }, (_, index) => (
<line key={index} x1="50" y1="0" x2="50" y2="32" transform={`rotate(${index * 22.5} 50 50)`} />
))}
</g>
),
corners: (
<>
<path d="M0 0H34L0 34Z" />
<path d="M100 0V34L66 0Z" />
<path d="M0 100H34L0 66Z" />
<path d="M100 100V66L66 100Z" />
</>
),
duo: (
<>
<rect width="46" height="46" />
<rect x="54" y="54" width="46" height="46" />
</>
),
// La barre déborde de chaque côté : l'écrasement vertical l'étire d'autant en
// largeur, et ses bouts restent dehors.
slab: <rect x="-8" width="116" y="34" height="32" />,
dropCut: <path fillRule="evenodd" d="M50 0A50 50 0 1 1 50 100A50 50 0 1 1 50 0Z M68 20C74 30 86 37 86 46A18 18 0 0 1 50 46C50 37 62 30 68 20Z" />,
keyhole: (
<>
<path fillRule="evenodd" d="M0 0H100V100H0Z M0 26A26 26 0 0 1 0 74Z" />
<rect x="14" y="40" width="20" height="20" />
</>
),
gate: <path d="M10 100V50A40 40 0 0 1 90 50V100" fill="none" stroke="currentColor" strokeWidth="20" />,
halfBars: <path fillRule="evenodd" d="M0 0H100V100H0Z M6 54H94V64H6Z M6 70H94V80H6Z M6 86H94V96H6Z" />,
bands: (
<g fill="none" stroke="currentColor" strokeWidth="14">
<path d="M0 4L50 22L100 4" />
<path d="M0 30L50 48L100 30" />
<path d="M0 56L50 74L100 56" />
<path d="M0 82L50 100L100 82" />
</g>
),
peaks: (
<>
{[4, 38, 72].flatMap((cy) => [0, 25, 50, 75].map((cx) => <path key={`${cx}-${cy}`} d={`M${cx} ${cy + 22}L${cx + 12.5} ${cy}L${cx + 25} ${cy + 22}Z`} />))}
</>
),
bangDot: <circle cx="50" cy="86" r="12" />,
  dialHand: <rect x="47" y="6" width="6" height="44" rx="3" transform="rotate(45 50 50)" />,
// Les parts qu'un accent peut colorer : la pièce que la figure porte déjà,
// redessinée par-dessus dans la couleur d'accent — le disque du gong, la ligne
// du bas d'un champ de points, la première flèche de trois. Prominent, et
// pourtant la même figure : c'est ce qui distingue une tuile sans lui ajouter
// un motif dans un coin.
gongDisc: <circle cx="50" cy="24" r="20" />,
tentsSmall: <path d="M50 4L76 44H24Z" />,
// Le bas de la marche teintée descend sous le cadre avec celui de la forme :
// hissée, elle laisserait sinon une barre sombre sous l'accent.
stepsMiddle: <rect x="33" y="33" width="34" height="87" />,
gateCrown: <path d="M10 50A40 40 0 0 1 90 50" fill="none" stroke="currentColor" strokeWidth="20" />,
domesLower: <path d="M0 100A50 50 0 0 1 100 100Z" />,
chevronsFirst: <path d="M4 8L40 50L4 92" fill="none" stroke="currentColor" strokeWidth="18" />,
stairsMiddle: <rect x="33" y="33" width="34" height="34" />,
raysCardinal: (
<g stroke="currentColor" strokeWidth="4">
{[0, 4, 8, 12].map((i) => (
<line key={i} x1="50" y1="0" x2="50" y2="32" transform={`rotate(${i * 22.5} 50 50)`} />
))}
</g>
),
fieldRow: (
<>
{[9, 25, 41, 57, 73, 89].map((cx) => <circle key={cx} cx={cx} cy="85" r="6" />)}
</>
),
dotsRow: (
<>
{[18, 50, 82].map((cx) => <circle key={cx} cx={cx} cy="82" r="13" />)}
</>
),
checkerOne: <rect x="50" y="50" width="50" height="50" />,
checker3Centre: <rect x="33" y="33" width="34" height="34" />,
gridMid: <rect y="48" width="100" height="4" />,
noiseSecond: (
<>
{Array.from({ length: 64 }, (_, index) => {
const x = index % 8
const y = Math.floor(index / 8)
return (x * 3 + y * 5) % 7 === 3 ? <rect key={index} x={x * 12.5} y={y * 12.5} width="12.5" height="12.5" /> : null
})}
</>
),
flowerPetal: <circle cx="30" cy="30" r="28" />,
burstSpark: <path d="M50 16Q57 43 84 50Q57 57 50 84Q43 57 16 50Q43 43 50 16Z" />,
eyeIris: <circle cx="50" cy="50" r="11" />,
sunDisc: <circle cx="50" cy="50" r="20" />,
targetCore: <circle cx="50" cy="50" r="14" />,
ringHalf: <path d="M50 14A36 36 0 0 0 50 86" fill="none" stroke="currentColor" strokeWidth="28" />,
zigzagFirst: <path d="M0 25L25 50L50 25V60L25 85L0 60Z" />,
moonLeft: <path d="M62 2A50 50 0 1 0 62 98A40 48 0 0 1 62 2Z" transform="translate(8 5) scale(0.55 0.9)" />,
pinwheelBlade: <path d="M50 50Q12 46 6 6Q46 12 50 50Z" />,
butterflyWing: <path d="M0 0A50 50 0 0 1 0 100Z" />,
bloomDisc: <circle cx="50" cy="23" r="19" />,
barsMiddle: <rect y="40" width="100" height="20" />,
slatsTop: <ellipse cx="50" cy="10" rx="50" ry="11" />,
// La rayure du milieu, celle qui traverse la tuile : c'est elle que l'accent
// colore.
stripesMiddle: <g transform="rotate(-45 50 50)"><rect x="-60" y="44" width="220" height="14" /></g>,
barcodeWidest: <rect x="72" width="13" height="100" />,
stripedDiscMid: <rect x="8" y="46" width="84" height="9" />,
framePanel: <rect x="24" y="24" width="52" height="52" />,
frameDiamondInner: <path d="M50 20L80 50L50 80L20 50Z" />,
roundedFrameInner: <rect x="28" y="28" width="44" height="44" rx="8" />,
squareBiteBite: <path d="M0 26A24 24 0 0 1 0 74Z" />,
splitBand: <path d="M0 62L62 0H100V38L38 100H0Z" />,
linksLoop: <path d="M22 36A14 14 0 0 0 22 64" fill="none" stroke="currentColor" strokeWidth="15" />,
spiralTail: <path d="M28 62A26 26 0 1 0 54 36" fill="none" stroke="currentColor" strokeWidth="18" />,
halfBarsBand: <rect x="6" y="86" width="88" height="10" />,
bandsTop: <path d="M0 4L50 22L100 4" fill="none" stroke="currentColor" strokeWidth="14" />,
peaksRow: (
<>
{[0, 25, 50, 75].map((cx) => <path key={cx} d={`M${cx} 94L${cx + 12.5} 72L${cx + 25} 94Z`} />)}
</>
),
}
