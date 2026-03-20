import { LayoutDashboard, Logs, Workflow } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn } from '../../lib/utils';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/logs', label: 'Logs', icon: Logs },
  { to: '/pipelines', label: 'Pipelines', icon: Workflow },
];

export function Sidebar() {
  return (
    <aside className="border-r border-zinc-800 bg-zinc-950/90 p-4 backdrop-blur-sm">
      <div className="mb-6 rounded-lg border border-zinc-800 bg-zinc-900/70 p-3">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Control Plane</p>
        <h1 className="mt-2 text-lg font-semibold text-zinc-100">Webhook Dashboard</h1>
      </div>

      <nav className="space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-amber-500/15 text-amber-300'
                    : 'text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100',
                )
              }
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
