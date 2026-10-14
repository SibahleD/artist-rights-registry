const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api'

export class ApiError extends Error {
  details?: string[]
  data?: any
  constructor(message: string, details?: string[], data?: any) { super(message); this.details = details; this.data = data }
}

export const getToken = () => localStorage.getItem('token')
export const setToken = (t: string | null) => (t ? localStorage.setItem('token', t) : localStorage.removeItem('token'))

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
  if (res.status === 401 && getToken()) { setToken(null); window.location.href = '/login' }
  if (!res.ok) throw new ApiError(data.error || 'Something went wrong.', data.details ?? data.problems, data)
  return data as T
}