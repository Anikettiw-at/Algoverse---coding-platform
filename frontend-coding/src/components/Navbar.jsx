import { NavLink } from 'react-router';
import { useDispatch, useSelector } from 'react-redux';
import { Code2, Swords, ListChecks, ShieldCheck, LogOut, Menu } from 'lucide-react';
import { logoutUser } from '../authSlice';

export function Logo({ size = 'md' }) {
  const box = size === 'lg' ? 'w-11 h-11' : 'w-9 h-9';
  const text = size === 'lg' ? 'text-2xl' : 'text-xl';
  return (
    <span className="flex items-center gap-2.5">
      <span className={`${box} rounded-xl grid place-items-center bg-gradient-to-br from-primary via-secondary to-accent shadow-lg shadow-primary/30`}>
        <Code2 className="text-white" size={size === 'lg' ? 24 : 20} strokeWidth={2.5} />
      </span>
      <span className={`${text} font-extrabold tracking-tight`}>
        Algo<span className="text-gradient">Verse</span>
      </span>
    </span>
  );
}

const linkClass = ({ isActive }) =>
  `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
    isActive ? 'bg-primary/15 text-primary' : 'text-base-content/70 hover:text-base-content hover:bg-base-300/60'
  }`;

function Navbar() {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const isAdmin = user?.role === 'admin';
  const initial = user?.firstName?.charAt(0)?.toUpperCase() ?? '?';

  const links = (
    <>
      <NavLink to="/" end className={linkClass}>
        <ListChecks size={16} /> Problems
      </NavLink>
      <NavLink to="/battle" className={linkClass}>
        <Swords size={16} /> 1v1 Battle
      </NavLink>
      {isAdmin && (
        <NavLink to="/admin" className={linkClass}>
          <ShieldCheck size={16} /> Admin
        </NavLink>
      )}
    </>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-base-content/10 bg-base-200/80 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <NavLink to="/" aria-label="AlgoVerse home">
            <Logo />
          </NavLink>
          <div className="hidden md:flex items-center gap-1">{links}</div>
        </div>

        <div className="flex items-center gap-2">
          {/* Mobile menu */}
          <div className="dropdown dropdown-end md:hidden">
            <button tabIndex={0} className="btn btn-ghost btn-square btn-sm" aria-label="Open menu">
              <Menu size={20} />
            </button>
            <div tabIndex={0} className="dropdown-content mt-3 w-52 rounded-box border border-base-content/10 bg-base-100 p-2 shadow-xl z-50 flex flex-col gap-1">
              {links}
            </div>
          </div>

          {/* User menu */}
          <div className="dropdown dropdown-end">
            <button tabIndex={0} className="flex items-center gap-2 rounded-full pl-1 pr-3 py-1 hover:bg-base-300/60 transition-colors">
              <span className="w-8 h-8 rounded-full grid place-items-center bg-gradient-to-br from-primary to-secondary text-white text-sm font-bold">
                {initial}
              </span>
              <span className="hidden sm:block text-sm font-medium">{user?.firstName}</span>
            </button>
            <ul tabIndex={0} className="menu dropdown-content mt-3 w-56 rounded-box border border-base-content/10 bg-base-100 p-2 shadow-xl z-50">
              <li className="menu-title">
                <span className="truncate">{user?.emailId}</span>
              </li>
              {isAdmin && (
                <li>
                  <NavLink to="/admin"><ShieldCheck size={16} /> Admin panel</NavLink>
                </li>
              )}
              <li>
                <button onClick={() => dispatch(logoutUser())} className="text-error">
                  <LogOut size={16} /> Log out
                </button>
              </li>
            </ul>
          </div>
        </div>
      </nav>
    </header>
  );
}

export default Navbar;
