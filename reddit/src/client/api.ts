import type { DayResponse, PlayRequest, PlayResponse, ShareResponse } from '../shared/api'

async function call<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, body === undefined ? undefined : {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`)
  return (await response.json()) as T
}

export const fetchDay = () => call<DayResponse>('/api/day')
export const postPlay = (result: PlayRequest) => call<PlayResponse>('/api/play', result)
export const postShare = (text: string) => call<ShareResponse>('/api/share', { text })
