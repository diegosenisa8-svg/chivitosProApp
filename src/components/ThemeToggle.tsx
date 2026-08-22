import { useTheme } from '../context/ThemeContext'

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      className={`theme-toggle ${className}`.trim()}
      onClick={toggleTheme}
      aria-label={isDark ? 'Cambiar a modo día' : 'Cambiar a modo noche'}
      title={isDark ? 'Modo día' : 'Modo noche'}
    >
      <span className="theme-toggle-icon" aria-hidden="true">
        {isDark ? '☀️' : '🌙'}
      </span>
      <span className="sr-only">{isDark ? 'Modo día' : 'Modo noche'}</span>
    </button>
  )
}
