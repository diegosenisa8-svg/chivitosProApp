import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { apiUrl, getApiBase } from '../lib/apiBase'

const TOKEN_KEY = 'chivitos-customer-token'

export type CustomerUser = {
  id: string
  email: string
  name: string
  phone: string
}

type CustomerAuthValue = {
  customer: CustomerUser | null
  booting: boolean
  login: (email: string, password: string) => Promise<void>
  loginWithGoogle: (data: {
    googleIdToken: string
    name?: string
    phone?: string
  }) => Promise<void>
  logout: () => void
  getToken: () => string | null
  refreshMe: () => Promise<void>
}

const CustomerAuthContext = createContext<CustomerAuthValue | null>(null)

/**
 * El token vive solo en localStorage: antes se guardaba duplicado también en
 * sessionStorage, así que había dos copias que podían quedar desincronizadas.
 * (El paso siguiente, más adelante, sería moverlo a una cookie httpOnly.)
 */
function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

function storeToken(token: string | null) {
  try {
    // Limpia la copia vieja en sessionStorage de sesiones anteriores.
    sessionStorage.removeItem(TOKEN_KEY)
    if (!token) {
      localStorage.removeItem(TOKEN_KEY)
      return
    }
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    /* ignore */
  }
}

async function authFetch<T>(path: string, init: RequestInit = {}, token?: string | null): Promise<T> {
  if (getApiBase() === null) throw new Error('API no disponible')
  const headers = new Headers(init.headers || {})
  headers.set('Content-Type', 'application/json')
  const t = token ?? getStoredToken()
  if (t) headers.set('Authorization', `Bearer ${t}`)
  const res = await fetch(apiUrl(path), { ...init, headers })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
  return data as T
}

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<CustomerUser | null>(null)
  const [booting, setBooting] = useState(true)

  const refreshMe = useCallback(async () => {
    const token = getStoredToken()
    if (!token || getApiBase() === null) {
      setCustomer(null)
      return
    }
    const me = await authFetch<CustomerUser>('/api/auth/me', {}, token)
    setCustomer(me)
  }, [])

  useEffect(() => {
    refreshMe()
      .catch(() => {
        storeToken(null)
        setCustomer(null)
      })
      .finally(() => setBooting(false))
  }, [refreshMe])

  const value = useMemo<CustomerAuthValue>(
    () => ({
      customer,
      booting,
      getToken: getStoredToken,
      refreshMe,
      logout: () => {
        storeToken(null)
        setCustomer(null)
      },
      login: async (email, password) => {
        const data = await authFetch<{ token: string; customer: CustomerUser }>('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        })
        storeToken(data.token)
        setCustomer(data.customer)
      },
      loginWithGoogle: async (payload) => {
        const data = await authFetch<{ token: string; customer: CustomerUser }>(
          '/api/auth/google',
          {
            method: 'POST',
            body: JSON.stringify(payload),
          },
        )
        storeToken(data.token)
        setCustomer(data.customer)
      },
    }),
    [customer, booting, refreshMe],
  )

  return (
    <CustomerAuthContext.Provider value={value}>{children}</CustomerAuthContext.Provider>
  )
}

export function useCustomerAuth() {
  const ctx = useContext(CustomerAuthContext)
  if (!ctx) throw new Error('useCustomerAuth outside provider')
  return ctx
}
