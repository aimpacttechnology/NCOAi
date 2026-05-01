import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface Soldier {
  id: string;
  first_name: string;
  last_name: string;
  rank: string;
  mos: string | null;
  notes: string | null;
  created_at: string;
}

interface Counseling {
  id: string;
  type: string;
  generated_output: string | null;
  created_at: string;
}

type Tab = 'overview' | 'history' | 'notes';

export default function SoldierDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [soldier, setSoldier] = useState<Soldier | null>(null);
  const [counselings, setCounselings] = useState<Counseling[]>([]);
  const [tab, setTab] = useState<Tab>('overview');
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [expandedCounseling, setExpandedCounseling] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const [soldierRes, counselingsRes] = await Promise.all([
        supabase.from('soldiers').select('*').eq('id', id).single(),
        supabase.from('counselings').select('*').eq('soldier_id', id).order('created_at', { ascending: false }),
      ]);
      if (soldierRes.data) {
        setSoldier(soldierRes.data);
        setNotes(soldierRes.data.notes ?? '');
      }
      if (counselingsRes.data) setCounselings(counselingsRes.data);
      setLoading(false);
    };
    load();
  }, [id]);

  const saveNotes = async () => {
    if (!id) return;
    setSavingNotes(true);
    await supabase.from('soldiers').update({ notes }).eq('id', id);
    setSavingNotes(false);
  };

  if (loading) {
    return <div className="p-8 font-mono text-army-muted">LOADING...</div>;
  }

  if (!soldier) {
    return <div className="p-8 font-mono text-danger">Soldier not found.</div>;
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'OVERVIEW' },
    { key: 'history', label: `COUNSELING HISTORY (${counselings.length})` },
    { key: 'notes', label: 'NOTES' },
  ];

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Back */}
      <button
        onClick={() => navigate('/soldiers')}
        className="font-mono text-xs text-army-muted hover:text-army-text mb-6 flex items-center gap-2 transition-colors"
      >
        ← BACK TO ROSTER
      </button>

      {/* Soldier Header */}
      <div className="bg-surface border border-border p-6 mb-6">
        <div className="font-mono text-army-gold text-lg font-bold">
          {soldier.rank} {soldier.last_name}, {soldier.first_name}
        </div>
        <div className="font-mono text-army-muted text-xs mt-1">
          MOS: {soldier.mos || '—'} &nbsp;|&nbsp; Added: {new Date(soldier.created_at).toLocaleDateString()}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border mb-6">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 font-mono text-xs tracking-wider transition-colors ${
              tab === t.key
                ? 'border-b-2 border-army-gold text-army-gold'
                : 'text-army-muted hover:text-army-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface border border-border p-4">
              <div className="font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Full Name</div>
              <div className="font-mono text-sm text-army-text">{soldier.rank} {soldier.first_name} {soldier.last_name}</div>
            </div>
            <div className="bg-surface border border-border p-4">
              <div className="font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">MOS</div>
              <div className="font-mono text-sm text-army-text">{soldier.mos || 'Not assigned'}</div>
            </div>
            <div className="bg-surface border border-border p-4">
              <div className="font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Total Counselings</div>
              <div className="font-mono text-sm text-army-gold">{counselings.length}</div>
            </div>
            <div className="bg-surface border border-border p-4">
              <div className="font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Last Counseled</div>
              <div className="font-mono text-sm text-army-text">
                {counselings[0] ? new Date(counselings[0].created_at).toLocaleDateString() : 'Never'}
              </div>
            </div>
          </div>
          <button
            onClick={() => navigate('/counseling/new')}
            className="bg-army-tan hover:bg-[#9e8562] text-army-text font-mono text-xs tracking-widest uppercase px-5 py-2.5 transition-colors"
          >
            + NEW COUNSELING
          </button>
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-3">
          {counselings.length === 0 ? (
            <div className="border border-border p-8 text-center font-mono text-army-muted text-sm">
              No counselings on record.
            </div>
          ) : (
            counselings.map(c => (
              <div key={c.id} className="border border-border bg-surface">
                <button
                  onClick={() => setExpandedCounseling(expandedCounseling === c.id ? null : c.id)}
                  className="w-full text-left px-4 py-3 flex items-center justify-between"
                >
                  <div>
                    <span className="font-mono text-xs text-army-gold uppercase">{c.type}</span>
                    <span className="font-mono text-xs text-army-muted ml-3">
                      {new Date(c.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <span className="font-mono text-xs text-army-muted">
                    {expandedCounseling === c.id ? '▲' : '▼'}
                  </span>
                </button>
                {expandedCounseling === c.id && c.generated_output && (
                  <div className="px-4 pb-4 border-t border-border">
                    <pre className="font-mono text-xs text-army-text whitespace-pre-wrap leading-relaxed mt-3">
                      {c.generated_output}
                    </pre>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'notes' && (
        <div className="space-y-3">
          <div className="font-mono text-xs text-army-muted mb-2">
            Private notes on this soldier — not part of official record.
          </div>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={10}
            className="w-full bg-surface border border-border px-4 py-3 font-mono text-sm text-army-text placeholder-army-muted focus:outline-none focus:border-army-tan resize-none"
            placeholder="Add your notes here..."
          />
          <button
            onClick={saveNotes}
            disabled={savingNotes}
            className="bg-army-tan hover:bg-[#9e8562] disabled:opacity-50 text-army-text font-mono text-xs tracking-widest uppercase px-5 py-2.5 transition-colors"
          >
            {savingNotes ? 'SAVING...' : 'SAVE NOTES'}
          </button>
        </div>
      )}
    </div>
  );
}
