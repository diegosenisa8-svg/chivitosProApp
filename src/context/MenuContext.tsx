import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import fallbackMenu from '../data/menu.json'
import { apiUrl, getApiBase } from '../lib/apiBase'
import { prepareMenu } from '../lib/menuUtils'
import type { MenuData } from '../types'

type MenuContextValue = {
  menu: MenuData
  loading: boolean
  error: string | null
  fromApi: boolean
  setOpenOverride: (open: boolean) => void
}

const MenuContext = createContext<MenuContextValue | null>(null)
const OPEN_KEY = 'chivitos-open-override'

export function MenuProvider({ children }: { children: ReactNode }) {
  const [raw, setRaw] = useState<MenuData>(fallbackMenu as MenuData)
  const [loading, setLoading] = useState(getApiBase() !== null)
  const [error, setError] = useState<string | null>(null)
  const [fromApi, setFromApi] = useState(false)
  const [openOverride, setOpenOverrideState] = useState<boolean | null>(() => {
    try {
      const v = localStorage.getItem(OPEN_KEY)
      if (v === null) return null
      return v === 'true'
    } catch {
      return null
    }
  })

  useEffect(() => {
    if (getApiBase() === null) {
      setLoading(false)
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(apiUrl('/api/menu'))
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as MenuData
        if (!cancelled) {
          setRaw(data)
          setFromApi(true)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'API error')
          setRaw(fallbackMenu as MenuData)
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

  const menu = useMemo(() => {
    const prepared = prepareMenu(raw)
    if (openOverride === null) return prepared
    return {
      ...prepared,
      restaurant: { ...prepared.restaurant, open: openOverride },
    }
  }, [raw, openOverride])

  return (
    <MenuContext.Provider
      value={{
        menu,
        loading,
        error,
        fromApi,
        setOpenOverride: (open) => {
          setOpenOverrideState(open)
          localStorage.setItem(OPEN_KEY, String(open))
        },
      }}
    >
      {children}
    </MenuContext.Provider>
  )
}

export function useMenu() {
  const ctx = useContext(MenuContext)
  if (!ctx) throw new Error('useMenu must be used within MenuProvider')
  return ctx
}
