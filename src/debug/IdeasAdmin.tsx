import { useEffect, useState } from 'react'
import { archiveIdea, deleteIdea, fetchAdminIdeas, type AdminIdea } from '../lib/cloud'

/*
 * La boîte à idées vue de l'intérieur : cinq tapes sur « Boîte à idées »
 * l'ouvrent, que seul un administrateur (0028, `admins`) remplit. Outil de
 * développeur, donc libellés français hors de l'i18n, comme la planche.
 * Le chargeur écrit sur le serveur ; la vue, que la planche montre avec des
 * doublures, n'écrit rien elle-même.
 */

/** Le chargeur : lit la liste, archive et efface pour de vrai. */
export function IdeasAdmin({ onClose }: { onClose(): void }) {
  const [ideas, setIdeas] = useState<AdminIdea[] | null | 'loading'>('loading')
  useEffect(() => {
    fetchAdminIdeas().then(setIdeas)
  }, [])
  const patch = (id: string, change: Partial<AdminIdea> | null) =>
    setIdeas((current) =>
      Array.isArray(current)
        ? change === null
          ? current.filter((idea) => idea.id !== id)
          : current.map((idea) => (idea.id === id ? { ...idea, ...change } : idea))
        : current,
    )
  return (
    <IdeasAdminView
      ideas={ideas}
      onArchive={async (id, archived) => {
        const ok = await archiveIdea(id, archived)
        if (ok) patch(id, { archivedAt: archived ? new Date().toISOString() : null })
        return ok
      }}
      onDelete={async (id) => {
        const ok = await deleteIdea(id)
        if (ok) patch(id, null)
        return ok
      }}
      onClose={onClose}
    />
  )
}

type Tab = 'open' | 'archived'

const when = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** Ce qui se colle tel quel dans une conversation pour en tirer un backlog. */
function ideasAsText(ideas: readonly AdminIdea[]): string {
  return ideas
    .map((idea) => `- [${idea.lang ?? '?'} · ${idea.author} · ${idea.authorRuns} parties · ${when(idea.createdAt)}] ${idea.body.replace(/\s+/g, ' ')}`)
    .join('\n')
}

export function IdeasAdminView({
  ideas,
  onArchive,
  onDelete,
  onClose,
}: {
  /** `null` : pas administrateur, ou serveur muet. */
  ideas: readonly AdminIdea[] | null | 'loading'
  onArchive(id: string, archived: boolean): Promise<boolean>
  onDelete(id: string): Promise<boolean>
  onClose(): void
}) {
  const [tab, setTab] = useState<Tab>('open')
  const [confirming, setConfirming] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [copied, setCopied] = useState(false)

  if (ideas === 'loading') return <p className="note">Chargement…</p>
  if (ideas === null) {
    return (
      <section className="ideas-admin stack">
        <p className="note">Réservé à l’administrateur (ou serveur injoignable).</p>
        <button type="button" className="btn btn--quiet btn--muted" onClick={onClose}>
          Fermer
        </button>
      </section>
    )
  }

  const open = ideas.filter((idea) => idea.archivedAt === null)
  const archived = ideas.filter((idea) => idea.archivedAt !== null)
  const shown = tab === 'open' ? open : archived
  const act = async (work: Promise<boolean>) => setFailed(!(await work))

  return (
    <section className="ideas-admin stack">
      <div className="spread">
        <p className="section-title">Idées reçues</p>
        <button type="button" className="btn btn--quiet btn--muted" onClick={onClose}>
          Fermer
        </button>
      </div>
      <div className="layer-tabs" role="tablist">
        {(['open', 'archived'] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`layer-tab${tab === id ? ' layer-tab--on' : ''}`}
            onClick={() => setTab(id)}
          >
            {id === 'open' ? `À traiter (${open.length})` : `Archivées (${archived.length})`}
          </button>
        ))}
      </div>
      {tab === 'open' && open.length > 0 && (
        <button
          type="button"
          className="btn btn--ghost btn--block"
          onClick={() =>
            navigator.clipboard
              ?.writeText(ideasAsText(open))
              .then(() => setCopied(true), () => setFailed(true))
          }
        >
          {copied ? 'Copié : colle-le à Claude pour un backlog' : 'Copier les idées à traiter'}
        </button>
      )}
      {failed && <p className="note note--warn">Le serveur n’a pas suivi. Réessaie.</p>}
      {shown.length === 0 && <p className="note">{tab === 'open' ? 'Rien à traiter.' : 'Aucune idée archivée.'}</p>}
      <ul className="ideas-list">
        {shown.map((idea) => (
          <li key={idea.id} className="idea-item">
            <p className="idea-body">{idea.body}</p>
            <p className="note">
              {idea.author} · {idea.lang ?? '?'} · {idea.authorRuns} parties · {when(idea.createdAt)}
              {idea.source === 'prompt' && ' · demandée'}
            </p>
            <div className="friend-actions">
              {confirming === idea.id ? (
                <>
                  <button type="button" className="btn btn--quiet" onClick={() => act(onDelete(idea.id))}>
                    Effacer pour de bon
                  </button>
                  <button type="button" className="btn btn--quiet btn--muted" onClick={() => setConfirming(null)}>
                    Annuler
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="btn btn--quiet" onClick={() => act(onArchive(idea.id, idea.archivedAt === null))}>
                    {idea.archivedAt === null ? 'Archiver' : 'Remettre à traiter'}
                  </button>
                  <button type="button" className="btn btn--quiet btn--muted" onClick={() => setConfirming(idea.id)}>
                    Effacer
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
