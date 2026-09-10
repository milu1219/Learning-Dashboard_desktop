import { Link, Route, Routes } from 'react-router-dom';
import { BrainCircuit, Home, Plus } from 'lucide-react';
import Dashboard from './pages/Dashboard.jsx';
import NewSession from './pages/NewSession.jsx';
import SessionDetail from './pages/SessionDetail.jsx';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <header className="bg-white border-b border-slate-200">
        <nav className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 font-bold text-slate-900"><BrainCircuit className="text-indigo-600" /> Learning Dashboard</Link>
          <div className="flex items-center gap-2 text-sm font-medium">
            <Link to="/" className="nav-link"><Home size={16} /> Dashboard</Link>
            <Link to="/new-session" className="nav-link nav-link-primary"><Plus size={16} /> New Session</Link>
          </div>
        </nav>
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8">
        <Routes><Route path="/" element={<Dashboard />} /><Route path="/new-session" element={<NewSession />} /><Route path="/sessions/:id" element={<SessionDetail />} /></Routes>
      </main>
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">Personal Learning Orchestrator · MVP Phase 2 Gemini Analysis</footer>
    </div>
  );
}
