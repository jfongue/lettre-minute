import { describe, expect, it } from 'vitest'
import { parseBackend } from './backend'

const KEY = 'eyJhbGciOiJIUzI1NiJ9.anon-key-long-enough'

describe('parseBackend', () => {
  it("reads an empty page as the build's own server", () => {
    expect(parseBackend({})).toBeNull()
  })
  it('reads a moved server, without its trailing slash', () => {
    expect(parseBackend({ url: 'https://api.example.org/', anonKey: KEY })).toEqual({ url: 'https://api.example.org', anonKey: KEY })
  })
  it('refuses what would leak the session or break the client', () => {
    expect(parseBackend({ url: 'http://api.example.org', anonKey: KEY })).toBeUndefined()
    expect(parseBackend({ url: 'not a url', anonKey: KEY })).toBeUndefined()
    expect(parseBackend({ url: 'https://api.example.org' })).toBeUndefined()
    expect(parseBackend({ url: 'https://api.example.org', anonKey: 'short' })).toBeUndefined()
    expect(parseBackend(null)).toBeUndefined()
    expect(parseBackend([])).toBeUndefined()
  })
})
