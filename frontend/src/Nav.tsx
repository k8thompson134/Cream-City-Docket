import { NavLink } from 'react-router-dom'
import './Nav.css'

export default function Nav() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <NavLink to="/" className="site-logo">Cream City Docket</NavLink>
        <nav className="site-nav">
          <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-link nav-link--active' : 'nav-link'}>The Docket</NavLink>
          <NavLink to="/alders" className={({ isActive }) => isActive ? 'nav-link nav-link--active' : 'nav-link'}>Alders</NavLink>
          <NavLink to="/mayor" className={({ isActive }) => isActive ? 'nav-link nav-link--active' : 'nav-link'}>Mayor</NavLink>
          <NavLink to="/about" className={({ isActive }) => isActive ? 'nav-link nav-link--active' : 'nav-link'}>About</NavLink>
          <NavLink to="/settings" className={({ isActive }) => isActive ? 'nav-link nav-link--active' : 'nav-link'}>Settings</NavLink>
          <NavLink to="/subscribe" className="nav-link nav-link--cta">Subscribe →</NavLink>
        </nav>
      </div>
    </header>
  )
}
