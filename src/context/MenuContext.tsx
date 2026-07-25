import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import fallbackMenu from '../data/menu.json'
import type { MenuData } from '../types'

type MenuContextValue = {
  menu: MenuData
  loading: boolean
  error: string | null
  fromApi: boolean
}

const MenuContext = createContext<MenuContextValue | null>(null)

const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

export function MenuProvider({ children }: { children: ReactNode }) {
  const [menu, setMenu] = useState<MenuData>(fallbackMenu as MenuData)
  const [loading, setLoading] = useState(Boolean(apiBase))
  const [error, setError] = useState<string | null>(null)
  const [fromApi, setFromApi] = useState(false)

  useEffect(() => {
    if (!apiBase) {
      setLoading(false)
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`${apiBase}/api/menu`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as MenuData
        if (!cancelled) {
          setMenu(data)
          setFromApi(true)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'API error')
          setMenu(fallbackMenu as MenuData)
          setFromApi(false)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <MenuContext.Provider value={{ menu, loading, error, fromApi }}>
      {children}
    </MenuContext.Provider>
  )
}

export function useMenu() {
  const ctx = useContext(MenuContext)
  if (!ctx) throw new Error('useMenu must be used within MenuProvider')
  return ctx
}
