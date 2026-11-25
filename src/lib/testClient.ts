/**
 * Whether this client is a test one — an agent driving the game through a
 * browser, a developer's dev server, or a browser the owner asked to leave out
 * of the figures. The answer travels with the runs (`pushRun`) to their `test`
 * column: a browser that plays by itself creates a fresh anonymous account
 * every time and would otherwise pass for a player.
 *
 * `import.meta.env.DEV` covers the dev server, which talks to the real project.
 * `navigator.webdriver` is what a browser under
 * automation reports; the flag covers a manual browser the owner wants out of
 * the figures without changing accounts.
 */
const FLAG_KEY = 'lettre-minute.test-client'

let decided: boolean | null = null

export function testClient(): boolean {
  if (decided !== null) return decided
  const driver = typeof navigator === 'undefined' ? false : navigator.webdriver === true
  try {
    decided = import.meta.env.DEV || driver || localStorage.getItem(FLAG_KEY) === '1'
  } catch {
    // No storage: a browser that says nothing is a real one.
    decided = import.meta.env.DEV || driver
  }
  return decided
}

/** Poses or lifts the flag: the next events carry it, the past ones do not. */
export function setTestClient(on: boolean): void {
  decided = on
  try {
    if (on) localStorage.setItem(FLAG_KEY, '1')
    else localStorage.removeItem(FLAG_KEY)
  } catch {
    /* the choice still holds for this session */
  }
}
