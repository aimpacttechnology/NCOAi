import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Login() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setSuccess('Account created. Check your email to confirm, then log in.');
        setMode('login');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="font-mono text-army-gold text-3xl font-bold tracking-[0.3em]">NCO.AI</div>
          <div className="font-mono text-army-tan text-xs tracking-[0.2em] mt-1 uppercase">
            Leadership Platform
          </div>
          <div className="mt-4 border-t border-border" />
        </div>

        {/* Mode toggle */}
        <div className="flex mb-6">
          {(['login', 'register'] as const).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(''); setSuccess(''); }}
              className={`flex-1 py-2 font-mono text-xs tracking-widest uppercase transition-colors ${
                mode === m
                  ? 'bg-army-tan text-army-text'
                  : 'bg-surface text-army-muted hover:text-army-text border border-border'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full bg-surface border border-border px-3 py-2.5 font-mono text-sm text-army-text placeholder-army-muted focus:outline-none focus:border-army-tan"
              placeholder="soldier@army.mil"
            />
          </div>

          <div>
            <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className="w-full bg-surface border border-border px-3 py-2.5 font-mono text-sm text-army-text placeholder-army-muted focus:outline-none focus:border-army-tan"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="bg-[#1f0e0d] border border-danger px-3 py-2 font-mono text-xs text-danger">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-[#0d1f12] border border-green-700 px-3 py-2 font-mono text-xs text-green-400">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-army-tan hover:bg-[#9e8562] disabled:opacity-50 text-army-text font-mono text-sm tracking-widest uppercase py-3 transition-colors"
          >
            {loading ? 'PROCESSING...' : mode === 'login' ? 'LOG IN' : 'CREATE ACCOUNT'}
          </button>
        </form>
      </div>
    </div>
  );
}
