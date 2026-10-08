import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { MessagesContext, messagesFor } from '../i18n'
import { DuelScreen } from './DuelScreen'

// Une table en ligne n'existe qu'une fois le serveur revenu : au premier rendu
// elle est absente, donc sans ma place. C'est ce rendu-là — celui du premier
// clic sur « Duel » — que l'écran doit traverser sans tomber.
vi.mock('../state/duel', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../state/duel')>()),
  useDuelTable: () => ({ phase: 'connecting', seats: [], myIndex: -1, at: 0, mode: 'online' }),
}))

describe('DuelScreen', () => {
  it('dit qu’il se connecte tant que ma place n’est pas posée', () => {
    const t = messagesFor('fr')
    const html = renderToStaticMarkup(
      <MessagesContext.Provider value={t}>
        <DuelScreen lang="fr" mode="online" join={null} onExit={() => undefined} />
      </MessagesContext.Provider>,
    )
    expect(html).toContain(t.duel.connecting)
  })
})
