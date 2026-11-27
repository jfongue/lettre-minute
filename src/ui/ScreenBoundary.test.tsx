import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { loadMessages } from '../i18n'
import { ScreenBoundary } from './ScreenBoundary'

describe('ScreenBoundary', () => {
  it('passes its screen through while nothing has failed', () => {
    expect(renderToStaticMarkup(<ScreenBoundary><p>écran</p></ScreenBoundary>)).toBe('<p>écran</p>')
  })

  it('offers a reload in the player’s language once a screen has failed', async () => {
    expect(ScreenBoundary.getDerivedStateFromError()).toEqual({ broken: true })
    const boundary = new ScreenBoundary({ children: null })
    boundary.state = { broken: true }
    boundary.context = await loadMessages('de')
    const html = renderToStaticMarkup(<>{boundary.render()}</>)
    expect(html).toContain('role="alertdialog"')
    expect(html).toContain('Neu laden')
  })
})
