import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const RANKS = [
  'PVT','PV2','PFC','SPC','CPL',
  'SGT','SSG','SFC','MSG','1SG','SGM','CSM','SMA',
  'WO1','CW2','CW3','CW4','CW5',
  '2LT','1LT','CPT','MAJ','LTC','COL',
];

export default function Profile() {
  const [form, setForm] = useState({
    rank: '',
    first_name: '',
    last_name: '',
    unit: '',
  });
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email ?? '');

      const { data } = await supabase
        .from('profiles')
        .select('rank, first_name, last_name, unit')
        .eq('id', user.id)
        .single();

      if (data) {
        setForm({
          rank:       data.rank       ?? '',
          first_name: data.first_name ?? '',
          last_name:  data.last_name  ?? '',
          unit:       data.unit       ?? '',
        });
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('profiles')
      .upsert({ id: user.id, ...form, role: 'nco' });

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const field = (key: keyof typeof form, value: string) =>
    setForm(f => ({ ...f, [key]: value }));

  return (
    <div className="p-8 max-w-xl mx-auto">
      <div className="mb-8">
        <div className="font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Settings</div>
        <h1 className="text-xl font-bold text-army-text">NCO Profile</h1>
        <div className="font-mono text-xs text-army-muted mt-1">{email}</div>
      </div>

      {loading ? (
        <div className="font-mono text-army-muted text-sm">Loading...</div>
      ) : (
        <form onSubmit={handleSave} className="space-y-5">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Rank</label>
              <select
                value={form.rank}
                onChange={e => field('rank', e.target.value)}
                className="w-full bg-surface border border-border px-3 py-2.5 font-mono text-sm text-army-text focus:outline-none focus:border-army-tan"
              >
                <option value="">--</option>
                {RANKS.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">First Name</label>
              <input
                value={form.first_name}
                onChange={e => field('first_name', e.target.value)}
                className="w-full bg-surface border border-border px-3 py-2.5 font-mono text-sm text-army-text focus:outline-none focus:border-army-tan"
              />
            </div>
            <div>
              <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Last Name</label>
              <input
                value={form.last_name}
                onChange={e => field('last_name', e.target.value)}
                className="w-full bg-surface border border-border px-3 py-2.5 font-mono text-sm text-army-text focus:outline-none focus:border-army-tan"
              />
            </div>
          </div>

          <div>
            <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Unit</label>
            <input
              value={form.unit}
              onChange={e => field('unit', e.target.value)}
              placeholder="e.g. 1-8 CAV, 1CD / HHC, 2BCT"
              className="w-full bg-surface border border-border px-3 py-2.5 font-mono text-sm text-army-text placeholder-army-muted focus:outline-none focus:border-army-tan"
            />
          </div>

          <div className="flex items-center gap-4 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-army-tan hover:bg-[#9e8562] disabled:opacity-50 text-army-text font-mono text-xs tracking-widest uppercase px-6 py-2.5 transition-colors"
            >
              {saving ? 'SAVING...' : 'SAVE PROFILE'}
            </button>
            {saved && (
              <span className="font-mono text-xs text-green-400">Profile saved.</span>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
