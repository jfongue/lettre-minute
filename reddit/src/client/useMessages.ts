import { useEffect, useState } from 'react'
import { loadMessages, messagesFor, type Locale } from '../../../src/i18n'

/** The post's language, French until its chunk arrives, as in `src/duel.tsx`. */
export function useMessages(locale: Locale) {
  const [messages, setMessages] = useState(() => messagesFor(locale))
  useEffect(() => {
    let live = true
    loadMessages(locale)
      .then((loaded) => {
        if (live) setMessages(loaded)
      })
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [locale])
  return messages
}
