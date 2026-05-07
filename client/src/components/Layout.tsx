import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const NAV = [
  { path: '/dashboard',      label: 'DASHBOARD',  icon: '⊞' },
  { path: '/soldiers',       label: 'SOLDIERS',   icon: '◉' },
  { path: '/counseling/new', label: 'COUNSELING', icon: '◈' },
  { path: '/ncoer',          label: 'NCOER',       icon: '★' },
  { path: '/promotion',      label: 'PROMOTION',   icon: '▲' },
  { path: '/training',       label: 'TRAINING',    icon: '▣' },
  { path: '/tasks',          label: 'TASKS',       icon: '☑' },
  { path: '/unit-gaps',      label: 'UNIT GAPS',   icon: '◎' },
  { path: '/awards',         label: 'DA 638',      icon: '✦' },
  { path: '/mentorship',     label: 'MENTORSHIP',  icon: '◆' },
  { path: '/plans',          label: 'DEV PLANS',   icon: '▣' },
  { path: '/journal',        label: 'JOURNAL',     icon: '◇' },
  { path: '/library',        label: 'DOC LIBRARY', icon: '▦' },
  { path: '/ask-sgm',        label: 'ASK THE SGM', icon: '⊕' },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-bg text-army-text">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 bg-surface border-r border-border flex flex-col">
        <div className="px-6 py-5 border-b border-border">
          <div className="font-mono text-army-gold font-bold text-lg tracking-[0.2em]">NCO.AI</div>
          <div className="font-mono text-army-tan text-[10px] tracking-[0.25em] mt-0.5 uppercase">Leadership Platform</div>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-0.5">
          {NAV.map(item => {
            const active = location.pathname === item.path ||
              (item.path !== '/dashboard' && location.pathname.startsWith(item.path.split('/')[1] ? `/${item.path.split('/')[1]}` : item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 font-mono text-xs tracking-wider transition-colors ${
                  active
                    ? 'bg-army-tan text-army-text'
                    : 'text-army-muted hover:bg-[#21262d] hover:text-army-text'
                }`}
              >
                <span className="text-base leading-none">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Unit customization banner */}
        <a
          href="https://aimpact-website-delta.vercel.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="block mx-3 mb-2 px-3 py-2 border border-army-gold/30 hover:border-army-gold bg-army-gold/5 hover:bg-army-gold/10 transition-colors text-center"
        >
          <div className="font-mono text-[9px] tracking-widest text-army-gold uppercase">Unit Customization</div>
          <div className="font-mono text-[8px] text-army-muted mt-0.5">Branded for your formation</div>
        </a>

        <div className="px-3 py-4 border-t border-border space-y-0.5">
          <Link
            to="/profile"
            className={`flex items-center gap-3 px-3 py-2 font-mono text-xs tracking-wider transition-colors ${
              location.pathname === '/profile'
                ? 'bg-army-tan text-army-text'
                : 'text-army-muted hover:bg-[#21262d] hover:text-army-text'
            }`}
          >
            <span className="text-base leading-none">⚙</span>
            PROFILE
          </Link>
          <button
            onClick={handleLogout}
            className="w-full text-left flex items-center gap-3 px-3 py-2 font-mono text-xs tracking-wider text-army-muted hover:text-danger transition-colors"
          >
            <span className="text-base leading-none">⏻</span>
            LOGOUT
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
