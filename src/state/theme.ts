import { setStatusBarDark } from '../lib/native'

/** `system` follows the phone; the other two hold whatever the phone says. */
export type Theme = 'system' | 'light' | 'dark'

const THEME_KEY = 'lettre-minute.theme.v1'
const systemDark = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null

export function loadTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    // Nothing stored is the light theme: the poster reads best on paper.
    return stored === 'system' || stored === 'dark' ? stored : 'light'
  } catch {
    return 'light'
  }
}

export function saveTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    /* the choice lasts until the app closes */
  }
}

let current: Theme = 'system'

function syncStatusBar(): void {
  setStatusBarDark(current === 'dark' || (current === 'system' && (systemDark?.matches ?? false)))
}

/** The tokens in styles.css switch on `data-theme`; without it, they follow the system. */
export function applyTheme(theme: Theme): void {
  current = theme
  if (theme === 'system') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = theme
  // The browser bar picks its colour by media query, which a forced theme contradicts.
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const dark = theme === 'system' ? meta.media.includes('dark') : theme === 'dark'
    meta.content = dark ? '#151515' : '#f2ecdf'
  }
  syncStatusBar()
}

systemDark?.addEventListener('change', syncStatusBar)
