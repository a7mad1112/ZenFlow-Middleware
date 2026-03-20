import { Navigate, Route, Routes } from 'react-router-dom';
import { Navbar } from './components/layout/navbar';
import { Sidebar } from './components/layout/sidebar';
import { DashboardPage } from './pages/dashboard-page';
import { LogsPage } from './pages/logs-page';
import { PipelinesPage } from './pages/pipelines-page';

function App() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto grid min-h-screen max-w-[1600px] grid-cols-1 md:grid-cols-[260px_1fr]">
        <Sidebar />
        <div className="flex min-h-screen flex-col">
          <Navbar />
          <main className="flex-1 p-4 md:p-6">
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/logs" element={<LogsPage />} />
              <Route path="/pipelines" element={<PipelinesPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </div>
  );
}

export default App;
