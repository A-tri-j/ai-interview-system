import { createContext, useCallback, useEffect, useMemo, useState } from 'react'

export const ThemeContext = createContext(null)

const ALL = ['dark', 'light', 'aurora']

function initialTheme() {
  try {
    const saved = localStorage.getItem('theme')
    if (ALL.includes(saved)) return saved
  } catch { /* ignore */ }
  return 'dark'
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(initialTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem('theme', theme) } catch { /* ignore */ }
  }, [theme])

  // list dile shudhu oi theme-gulor moddhe ghure (admin-e shudhu dark/light)
  const toggle = useCallback((list = ALL) => {
    setTheme((t) => list[(list.indexOf(t) + 1) % list.length])
  }, [])

  const value = useMemo(() => ({ theme, toggle }), [theme, toggle])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
