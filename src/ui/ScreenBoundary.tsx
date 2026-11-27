import { Component, Suspense, type ContextType, type ErrorInfo, type ReactNode } from 'react'
import { MessagesContext } from '../i18n'
import { Shape } from './bauhaus'

/**
 * A lazy screen's `<Suspense>`, plus what it lacked: a chunk that fails to
 * arrive (an update swapped the hashes, the network dropped) or a screen that
 * throws used to unmount the whole app and leave a blank page. `React.lazy`
 * keeps a rejected load for good, so the only way back is a reload, offered in
 * the game's own popup. Outside any provider the texts fall back to French.
 */
export class ScreenBoundary extends Component<{ children: ReactNode }, { broken: boolean }> {
  static contextType = MessagesContext
  declare context: ContextType<typeof MessagesContext>
  state = { broken: false }

  static getDerivedStateFromError(): { broken: boolean } {
    return { broken: true }
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error(error, info.componentStack)
  }

  render(): ReactNode {
    if (!this.state.broken) return <Suspense fallback={null}>{this.props.children}</Suspense>
    const t = this.context.broken
    return (
      <div className="offer-pop-layer" role="alertdialog" aria-modal="true" aria-labelledby="screen-broken-title">
        <div className="offer-pop-scrim" />
        <div className="offer-pop">
          <span className="offer-pop-art" aria-hidden="true">
            <span className="offer-pop-shape offer-pop-shape--circle">
              <Shape kind="triangle" tint="red" />
            </span>
          </span>
          <h2 id="screen-broken-title" className="offer-pop-title">
            {t.title}
          </h2>
          <p>{t.lead}</p>
          <div className="offer-pop-actions">
            <button type="button" className="btn btn--blue" onClick={() => location.reload()}>
              {t.reload}
            </button>
          </div>
        </div>
      </div>
    )
  }
}
