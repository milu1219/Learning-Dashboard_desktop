import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, BrainCircuit, Loader2 } from 'lucide-react';

export default function NewSession() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: '', subject: '', transcript: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const change = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  async function submit(event) {
    event.preventDefault(); setError('');
    if (!form.title.trim() || !form.subject.trim() || form.transcript.trim().length < 20) return setError('Enter a title, subject, and at least 20 characters of transcript.');
    try {
      setLoading(true);
      const response = await fetch('/api/ai/analyze-transcript', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Failed to analyze transcript.');
      navigate(`/sessions/${payload.session.id}`);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }
  return <div className="max-w-3xl mx-auto"><Link to="/" className="back-link"><ArrowLeft size={16} /> Back to dashboard</Link><div className="mt-5 mb-6"><h1 className="text-3xl font-bold">New Learning Session</h1><p className="text-slate-500 mt-1">Add your own session title, then analyze the transcript with Gemini.</p></div>
    <form onSubmit={submit} className="card space-y-5">{error && <div className="alert-error">{error}</div>}<Field label="Session Title"><input name="title" value={form.title} onChange={change} placeholder="e.g. Java OOP — Inheritance & Polymorphism" /></Field><Field label="Subject / Course"><input name="subject" value={form.subject} onChange={change} placeholder="e.g. Object-Oriented Programming" /></Field><Field label="Transcript"><textarea name="transcript" rows="11" value={form.transcript} onChange={change} placeholder="Paste your transcript or lesson content here…" /></Field><div className="flex justify-end gap-3 pt-4 border-t"><Link to="/" className="button-secondary">Cancel</Link><button disabled={loading} className="button-primary" type="submit">{loading ? <Loader2 className="animate-spin" size={17} /> : <BrainCircuit size={17} />} {loading ? 'Analyzing…' : 'Analyze with Gemini'}</button></div></form>
  </div>;
}
function Field({ label, children }) { return <label className="block text-sm font-medium text-slate-700">{label}<div className="mt-1">{children}</div></label>; }
