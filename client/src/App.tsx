import type { ReactNode } from 'react';
import { Link, Navigate, NavLink, Route, Routes, useLocation } from 'react-router';
import { useIsWide } from './lib/hooks';
import { AssignmentsPage } from './pages/AssignmentsPage';
import { CoachWorkstation } from './pages/CoachWorkstation';
import { PlayerPage } from './pages/PlayerPage';
import { WhoPage } from './pages/WhoPage';

function Shell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const isWide = useIsWide();
  const isCoach = pathname.startsWith('/coach');
  const isPlayer = pathname.startsWith('/player/');

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand" aria-label="Coach Film home">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-name">Coach Film</span>
        </Link>
        {isCoach && (
          <nav className="topnav">
            {isWide && (
              <NavLink to="/coach" end>
                Workstation
              </NavLink>
            )}
            <NavLink
              to="/coach/assignments"
              className={({ isActive }) => (isActive || (!isWide && pathname === '/coach') ? 'active' : '')}
            >
              Assignments
            </NavLink>
          </nav>
        )}
        <span className="spacer" />
        {(isCoach || isPlayer) && (
          <>
            <span className="role-tag">{isCoach ? 'Coach' : 'Player'}</span>
            <Link to="/" className="btn btn-sm btn-ghost">
              Switch
            </Link>
          </>
        )}
      </header>
      <main className="main">{children}</main>
    </div>
  );
}

/** Tagging and cutting happen on PC; at phone width the coach gets the assignments overview. */
function CoachHome() {
  return useIsWide() ? <CoachWorkstation /> : <AssignmentsPage />;
}

export function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<WhoPage />} />
        <Route path="/coach" element={<CoachHome />} />
        <Route path="/coach/assignments" element={<AssignmentsPage />} />
        <Route path="/player/:id" element={<PlayerPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}
