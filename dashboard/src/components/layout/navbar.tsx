import { Bell, Search } from 'lucide-react';
import { Button } from '../ui/button';

export function Navbar() {
  return (
    <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/70 px-4 py-3 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-400">
          <Search size={16} />
          <span>Search logs, pipelines, tasks...</span>
        </div>
        <Button variant="ghost" className="gap-2">
          <Bell size={16} />
          Notifications
        </Button>
      </div>
    </header>
  );
}
