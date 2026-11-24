/**
 * What a web portal's frame asks of the page, shared by the CrazyGames and
 * Playgama entries (`src/crazygames.tsx`, `src/playgama.tsx`) and styled by
 * `crazygames.css`, which both load.
 */

// The portal's iframe keeps its height under a phone's keyboard, which covers
// the bottom of the run instead: while a run's field has the focus on a touch
// screen, crazygames.css tightens the run above the keys. The class lingers a
// moment after a blur, so a tap on Skip or Enter that hands the focus back to
// the field does not make the screen jump twice.
export function tightenUnderKeyboard(): void {
  const touch = window.matchMedia('(pointer: coarse)')
  let loosen: ReturnType<typeof setTimeout> | undefined
  document.addEventListener('focusin', (event) => {
    if (!touch.matches || !(event.target instanceof HTMLInputElement) || !event.target.hasAttribute('data-keys')) return
    clearTimeout(loosen)
    document.documentElement.setAttribute('data-typing', '')
  })
  document.addEventListener('focusout', () => {
    clearTimeout(loosen)
    loosen = setTimeout(() => {
      if (!(document.activeElement instanceof HTMLInputElement && document.activeElement.hasAttribute('data-keys'))) document.documentElement.removeAttribute('data-typing')
    }, 400)
  })
}

// iOS draws no bar a page can style, only its own overlay while a finger
// moves (portal review: the portrait home scrolls with nothing to say so).
// There, a bar of the game's own follows the page whenever it is taller
// than the frame; Android and desktops keep the CSS one.
export function drawPageBarOnIos(): void {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (!ios) return
  const bar = document.createElement('div')
  bar.className = 'page-bar'
  bar.setAttribute('aria-hidden', 'true')
  const thumb = document.createElement('div')
  thumb.className = 'page-bar-thumb'
  bar.append(thumb)
  document.body.append(bar)
  const page = document.scrollingElement ?? document.documentElement
  let frame = 0
  const draw = () => {
    frame = 0
    const { scrollHeight, clientHeight, scrollTop } = page
    const room = scrollHeight - clientHeight
    bar.hidden = room <= 1
    if (bar.hidden) return
    const length = Math.max(32, (clientHeight * clientHeight) / scrollHeight)
    thumb.style.height = `${length}px`
    thumb.style.transform = `translateY(${((clientHeight - length) * Math.min(Math.max(scrollTop, 0), room)) / room}px)`
  }
  const redraw = () => {
    if (!frame) frame = requestAnimationFrame(draw)
  }
  window.addEventListener('scroll', redraw, { passive: true })
  window.addEventListener('resize', redraw)
  new ResizeObserver(redraw).observe(document.body)
  redraw()
}

