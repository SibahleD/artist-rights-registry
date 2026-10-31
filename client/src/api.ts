const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api'

export class ApiError extends Error {
  details?: string[]
  data?: any
  constructor(message: string, details?: string[], data?: any) { super(message); this.details = details; this.data = data }
}

export const getToken = () => localStorage.getItem('token')
export const setToken = (t: string | null) => (t ? localStorage.setItem('token', t) : localStorage.removeItem('token'))

export async function upload<T = any>(path: string, file: File, method = 'PUT', fields: Record<string, string> = {}): Promise<T> {
  const body = new FormData()
  for (const [k, v] of Object.entries(fields)) body.append(k, v)
  body.append('file', file)
  let res: Response
  try {
    res = await fetch(BASE + path, { method, headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {}, body })
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection and try again.')
  }
  const data = await res.json().catch(() => ({}))
  if (res.status === 401 && getToken()) { setToken(null); window.location.href = `${import.meta.env.BASE_URL}login` }
  // The host answers oversized uploads itself, with a page instead of our JSON error.
  if (res.status === 413 && !data.error) throw new ApiError('That file is too large to upload. Choose a smaller one.')
  if (!res.ok) throw new ApiError(data.error || 'The upload failed.', data.details ?? data.problems, data)
  return data as T
}

// Audio goes straight from the browser to the storage bucket, because the API host cannot take large request bodies.
// The server hands out a one-off signed URL, then reads the file back to check it once the upload is done.
// Without a bucket (local development) it falls back to sending the file through the server.
export async function uploadAudio<T = any>(trackPath: string, file: File): Promise<T> {
  const init = await api<{ direct: boolean; url?: string; key?: string; ticket?: string }>(
    `${trackPath}/audio/upload-url`, 'POST', { fileName: file.name, size: file.size })
  if (!init.direct) return upload<T>(`${trackPath}/audio/file`, file)
  const form = new FormData()
  form.append('cacheControl', '3600')
  form.append('', file)
  let res: Response
  try {
    res = await fetch(init.url!, { method: 'PUT', body: form })
  } catch {
    throw new ApiError('Cannot reach the file storage. Check your connection and try again.')
  }
  if (!res.ok) {
    throw new ApiError(res.status === 413
      ? 'That file is larger than the storage service allows. Choose a smaller file.'
      : 'The file could not be uploaded to storage. Please try again.')
  }
  return api<T>(`${trackPath}/audio/complete`, 'POST', { key: init.key, ticket: init.ticket, fileName: file.name })
}

export async function fetchBlob(path: string): Promise<Blob> {
  const res = await fetch(BASE + path, { headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {} })
  if (!res.ok) throw new ApiError('Could not load the file.')
  return res.blob()
}

export async function api<T = any>(path: string, method = 'GET', body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(BASE + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection and try again.')
  }
  const data = await res.json().catch(() => ({}))
  if (res.status === 401 && getToken()) { setToken(null); window.location.href = `${import.meta.env.BASE_URL}login` }
  if (!res.ok) throw new ApiError(data.error || 'Something went wrong.', data.details ?? data.problems, data)
  return data as T
}