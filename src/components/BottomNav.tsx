import { NavLink } from 'react-router-dom'

const tabs = [
  { to: '/', icon: '🏋️', label: 'Workout' },
  { to: '/routines', icon: '📋', label: 'Routines' },
  { to: '/exercises', icon: '💪', label: 'Exercises' },
  { to: '/progress', icon: '📈', label: 'Progress' },
  { to: '/settings', icon: '⚙️', label: 'Settings' },
]

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      {tabs.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="nav-icon">{t.icon}</span>
          {t.label}
        </NavLink>
      ))}
    </nav>
  )
}
