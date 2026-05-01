import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import SoldierCard from '../components/SoldierCard';

interface Soldier {
  id: string;
  first_name: string;
  last_name: string;
  rank: string;
  mos: string | null;
  created_at: string;
  last_counseling?: string | null;
}

const RANKS = ['PVT','PV2','PFC','SPC','CPL','SGT','SSG','SFC','MSG','1SG','SGM','CSM'];

const EMPTY_FORM = { first_name: '', last_name: '', rank: 'SPC', mos: '' };

export default function Soldiers() {
  const [soldiers, setSoldiers] = useState<Soldier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: soldierRows } = await supabase
      .from('soldiers')
      .select('*')
      .eq('nco_id', user.id)
      .order('last_name');

    if (!soldierRows) { setLoading(false); return; }

    // Attach last counseling date
    const enriched = await Promise.all(soldierRows.map(async s => {
      const { data } = await supabase
        .from('counselings')
        .select('created_at')
        .eq('soldier_id', s.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      return { ...s, last_counseling: data?.created_at ?? null };
    }));

    setSoldiers(enriched);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim()) return;
    setSaving(true);
    setError('');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error: err } = await supabase.from('soldiers').insert({
      nco_id: user.id,
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      rank: form.rank,
      mos: form.mos.trim() || null,
    });

    if (err) {
      setError(err.message);
    } else {
      setShowForm(false);
      setForm(EMPTY_FORM);
      await load();
    }
    setSaving(false);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="font-mono text-[10px] tracking-widest text-army-muted uppercase">Roster</div>
          <h1 className="text-xl font-bold text-army-text mt-0.5">Soldiers</h1>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-army-tan hover:bg-[#9e8562] text-army-text font-mono text-xs tracking-widest uppercase px-4 py-2 transition-colors"
        >
          + ADD SOLDIER
        </button>
      </div>

      {/* Add Soldier Form */}
      {showForm && (
        <form onSubmit={handleAdd} className="bg-surface border border-army-tan p-5 mb-6 space-y-4">
          <div className="font-mono text-xs tracking-widest text-army-gold uppercase mb-2">New Soldier</div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">First Name</label>
              <input
                value={form.first_name}
                onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                required
                className="w-full bg-bg border border-border px-3 py-2 font-mono text-sm text-army-text focus:outline-none focus:border-army-tan"
              />
            </div>
            <div>
              <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Last Name</label>
              <input
                value={form.last_name}
                onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                required
                className="w-full bg-bg border border-border px-3 py-2 font-mono text-sm text-army-text focus:outline-none focus:border-army-tan"
              />
            </div>
            <div>
              <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Rank</label>
              <select
                value={form.rank}
                onChange={e => setForm(f => ({ ...f, rank: e.target.value }))}
                className="w-full bg-bg border border-border px-3 py-2 font-mono text-sm text-army-text focus:outline-none focus:border-army-tan"
              >
                {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">MOS</label>
              <input
                value={form.mos}
                onChange={e => setForm(f => ({ ...f, mos: e.target.value }))}
                placeholder="e.g. 11B"
                className="w-full bg-bg border border-border px-3 py-2 font-mono text-sm text-army-text placeholder-army-muted focus:outline-none focus:border-army-tan"
              />
            </div>
          </div>
          {error && <div className="font-mono text-xs text-danger">{error}</div>}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="bg-army-tan hover:bg-[#9e8562] disabled:opacity-50 text-army-text font-mono text-xs tracking-widest uppercase px-5 py-2 transition-colors"
            >
              {saving ? 'SAVING...' : 'SAVE'}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setError(''); }}
              className="border border-border text-army-muted hover:text-army-text font-mono text-xs tracking-widest uppercase px-5 py-2 transition-colors"
            >
              CANCEL
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="font-mono text-army-muted text-sm py-12 text-center">LOADING ROSTER...</div>
      ) : soldiers.length === 0 ? (
        <div className="border border-border p-12 text-center">
          <div className="font-mono text-army-muted text-sm">No soldiers on roster.</div>
          <div className="font-mono text-army-muted text-xs mt-1">Click + ADD SOLDIER to get started.</div>
        </div>
      ) : (
        <div className="space-y-2">
          {soldiers.map(s => <SoldierCard key={s.id} soldier={s} />)}
        </div>
      )}
    </div>
  );
}
