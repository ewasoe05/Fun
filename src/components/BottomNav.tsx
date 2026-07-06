import { NavLink } from 'react-router-dom'
import { IconApple, IconBarbell, IconClipboard, IconDumbbell, IconGear, IconTrendingUp } from './icons'

const tabs = [
  { to: '/', icon: IconBarbell, label: 'Workout' },
  { to: '/routines', icon: IconClipboard, label: 'Routines' },
  { to: '/exercises', icon: IconDumbbell, label: 'Exercises' },
  { to: '/food', icon: IconApple, label: 'Food' },
  { to: '/progress', icon: IconTrendingUp, label: 'Progress' },
  { to: '/settings', icon: IconGear, label: 'Settings' },
]

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      {tabs.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="nav-icon">
            <t.icon />
          </span>
          {t.label}
        </NavLink>
      ))}
    </nav>
  )
}
