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
  if (!res.ok) throw new ApiError(data.error || 'The upload failed.', data.details ?? data.problems, data)
  return data as T
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