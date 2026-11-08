import { useTheme } from '../hooks/useTheme'

const ICON = { dark: '☾', light: '☀', aurora: '✦' }
const NAME = { dark: 'Dark', light: 'Light', aurora: 'Aurora' }

// simple = true toggles between dark/light only (for admin and company management portals)
export default function ThemeToggle({ simple = false }) {
  const { theme, toggle } = useTheme()
  const list = simple ? ['dark', 'light'] : ['dark', 'light', 'aurora']
  const next = list[(list.indexOf(theme) + 1) % list.length]
  return (
    <button
      type="button" className="icon-btn" onClick={() => toggle(list)}
      aria-label={`Switch to ${NAME[next]} theme`} title={`Switch to ${NAME[next]} theme`}
    >
      {ICON[theme]}
    </button>
  )
}
