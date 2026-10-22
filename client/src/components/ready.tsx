import { api, ApiError } from '../api'

export type ReadyResult =
  | { ok: true }
  | { ok: false; error: string; problems?: string[] }

export async function tryMarkReady(rid: string): Promise<ReadyResult> {
  try {
    await api(`/releases/${rid}/ready`, 'POST')
    return { ok: true }
  } catch (e) {
    const ae = e as ApiError
    if (ae.details) return { ok: false, error: ae.message, problems: ae.details }
    throw e
  }
}
