import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, getToken, setToken } from './api'
import type { User } from './types'

interface Ctx {
  user: User | null; loading: boolean
  login: (e: string, p: string) => Promise<void>
  register: (b: Record<string, string>) => Promise<void>
  logout: () => void; setUser: (u: User) => void
}
const AuthCtx = createContext<Ctx>(null!)

export const useAuth = () => useContext(AuthCtx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(!!getToken())

  useEffect(() => {
    if (!getToken()) return
    api<{ user: User }>('/auth/me').then((r: any) => setUser(r.user)).catch(() => setToken(null)).finally(() => setLoading(false))
  }, [])

  const finish = (r: { user: User; token: string }) => { setToken(r.token); setUser(r.user) }
  return (
    <AuthCtx.Provider value={{
      user, loading, setUser,
      login: async (email, password) => finish(await api('/auth/login', 'POST', { email, password })),
      register: async (b) => finish(await api('/auth/register', 'POST', b)),
      logout: () => { setToken(null); setUser(null) },
    }}>{children}</AuthCtx.Provider>
  )
}
