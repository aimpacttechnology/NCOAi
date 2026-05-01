import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { prepareMentorship } from '../lib/api';
import { calcScore, type PromotionData } from '../lib/promotionScore';

interface Soldier {
  id: string;
  first_name: string;
  last_name: string;
  rank: string;
  mos: string | null;
}

interface Session {
  id: string;
  session_date: string;
  nco_notes: string | null;
  follow_up_actions: { action: string; due_date: string; complete: boolean }[];
  next_session_date: string | null;
  ai_talking_points: string | null;
}

const FM622_AREAS = [
  'Character (Values / Empathy / Warrior Ethos)',
  'Presence (Bearing / Fitness / Confidence)',
  'Intellect (Judgment / Innovation / Expertise)',
  'Leads (Leads Others / Builds Trust / Communicates)',
  'Develops (Develops Others / Creates Environment)',
  'Achieves (Gets Results / Mission Focus)',
];

export default function MentorshipWizard() {
  const [soldiers, setSoldiers]         = useState<Soldier[]>([]);
  const [selected, setSelected]         = useState<Soldier | null>(null);
  const [sessions, setSessions]         = useState<Session[]>([]);
  const [promoData, setPromoData]       = useState<PromotionData | null>(null);
  const [lastCounseling, setLastCounseling] = useState<{ type: string; date: string } | null>(null);
  const [focus, setFocus]               = useState<string[]>([]);
  const [talkingPoints, setTalkingPoints] = useState('');
  const [preparing, setPreparing]       = useState(false);
  const [showForm, setShowForm]         = useState(false);
  const [sessionDate, setSessionDate]   = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes]               = useState('');
  const [followUps, setFollowUps]       = useState<{ action: string; due_date: string }[]>([]);
  const [nextDate, setNextDate]         = useState('');
  const [newAction, setNewAction]       = useState('');
  const [newDue, setNewDue]             = useState('');
  const [saving, setSaving]             = useState(false);
  const [userId, setUserId]             = useState('');
  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data } = await supabase.from('soldiers')
        .select('id, first_name, last_name, rank, mos')
        .eq('nco_id', user.id).order('last_name');
      if (data) setSoldiers(data);
      setLoading(false);
    };
    init();
  }, []);

  const selectSoldier = async (s: Soldier) => {
    setSelected(s);
    setTalkingPoints('');
    setShowForm(false);
    setFocus([]);
    setNotes('');
    setFollowUps([]);

    const [sessRes, promoRes, counselRes] = await Promise.all([
      supabase.from('mentorship_sessions').select('*').eq('soldier_id', s.id).order('session_date', { ascending: false }).limit(5),
      supabase.from('promotion_data').select('*').eq('soldier_id', s.id).single(),
      supabase.from('counselings').select('type, created_at').eq('soldier_id', s.id).order('created_at', { ascending: false }).limit(1).single(),
    ]);

    setSessions(sessRes.data ?? []);
    setPromoData(promoRes.data ? { ...promoRes.data, custom_points: promoRes.data.custom_points ?? [] } : null);
    setLastCounseling(counselRes.data ? { type: counselRes.data.type, date: counselRes.data.created_at } : null);
  };

  const handlePrepare = async () => {
    if (!selected) return;
    setPreparing(true);
    setTalkingPoints('');

    const scoreData = promoData ? calcScore(promoData) : null;
    const lastSession = sessions[0] ?? null;

    try {
      await prepareMentorship(
        {
          soldier: { name: `${selected.first_name} ${selected.last_name}`, rank: selected.rank, mos: selected.mos },
          promotionData: scoreData ? {
            target_rank: promoData!.target_rank,
            status: scoreData.status,
            total: scoreData.total,
            maxScore: scoreData.maxScore,
            gaps: scoreData.gaps,
          } : undefined,
          lastCounseling,
          lastMentorship: lastSession ? {
            date: lastSession.session_date,
            follow_ups: (lastSession.follow_up_actions ?? [])
              .filter(f => !f.complete).map(f => f.action),
          } : undefined,
          sessionFocus: focus,
        },
        chunk => setTalkingPoints(p => p + chunk)
      );
    } catch {
      setTalkingPoints('Failed to prepare session. Check server connection.');
    } finally {
      setPreparing(false);
    }
  };

  const addFollowUp = () => {
    if (!newAction.trim()) return;
    setFollowUps(f => [...f, { action: newAction.trim(), due_date: newDue }]);
    setNewAction(''); setNewDue('');
  };

  const saveSession = async () => {
    if (!selected || !userId) return;
    setSaving(true);
    const { error } = await supabase.from('mentorship_sessions').insert({
      soldier_id: selected.id,
      nco_id: userId,
      session_date: sessionDate,
      focus_areas: focus,
      ai_talking_points: talkingPoints || null,
      nco_notes: notes || null,
      follow_up_actions: followUps.map(f => ({ ...f, complete: false })),
      next_session_date: nextDate || null,
    });
    if (!error) {
      const { data } = await supabase.from('mentorship_sessions').select('*')
        .eq('soldier_id', selected.id).order('session_date', { ascending: false }).limit(5);
      setSessions(data ?? []);
      setShowForm(false);
      setNotes(''); setFollowUps([]); setNextDate('');
    }
    setSaving(false);
  };

  const daysSince = (date: string) =>
    Math.floor((Date.now() - new Date(date).getTime()) / 86400000);

  return (
    <div className="flex h-full">
      {/* ── Soldier list ── */}
      <div className="w-72 flex-shrink-0 border-r border-border flex flex-col">
        <div className="px-5 py-4 border-b border-border">
          <div className="font-mono text-[10px] tracking-widest text-army-muted uppercase">Step 1</div>
          <div className="font-mono text-sm font-bold text-army-text mt-0.5">Mentorship Sessions</div>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {loading ? (
            <div className="px-5 py-4 font-mono text-xs text-army-muted">Loading...</div>
          ) : soldiers.length === 0 ? (
            <div className="px-5 py-4 font-mono text-xs text-army-muted">No soldiers on roster.</div>
          ) : soldiers.map(s => (
            <button key={s.id} onClick={() => selectSoldier(s)}
              className={`w-full text-left px-5 py-3 border-b border-border transition-colors ${selected?.id === s.id ? 'bg-army-tan' : 'hover:bg-[#21262d]'}`}>
              <div className="font-mono text-xs font-bold text-army-text">{s.rank} {s.last_name}, {s.first_name}</div>
              <div className="font-mono text-[10px] text-army-muted mt-0.5">MOS: {s.mos || '—'}</div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Detail ── */}
      <div className="flex-1 overflow-y-auto">
        {!selected ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="font-mono text-4xl text-army-muted mb-3">◈</div>
              <div className="font-mono text-sm text-army-muted">Select a soldier to prepare a mentorship session</div>
            </div>
          </div>
        ) : (
          <div className="p-8 max-w-3xl">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="font-mono text-army-gold text-lg font-bold">
                  {selected.rank} {selected.last_name}, {selected.first_name}
                </div>
                <div className="font-mono text-xs text-army-muted mt-0.5">
                  {lastCounseling
                    ? `Last counseling: ${lastCounseling.type} — ${new Date(lastCounseling.date).toLocaleDateString()}`
                    : 'No counseling on record'}
                </div>
                {sessions[0] && (
                  <div className="font-mono text-xs text-army-muted">
                    Last mentorship: {daysSince(sessions[0].session_date)} days ago
                  </div>
                )}
              </div>
              <button onClick={() => setShowForm(!showForm)}
                className="bg-army-tan hover:bg-[#9e8562] text-army-text font-mono text-xs tracking-widest uppercase px-4 py-2 transition-colors">
                + LOG SESSION
              </button>
            </div>

            {/* Focus area selector */}
            <div className="mb-5">
              <div className="font-mono text-[10px] tracking-widest text-army-muted uppercase mb-2">
                Session Focus Areas (optional — leave blank to let AI decide)
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {FM622_AREAS.map(a => (
                  <button key={a} onClick={() => setFocus(f => f.includes(a) ? f.filter(x => x !== a) : [...f, a])}
                    className={`text-left px-3 py-2 font-mono text-xs transition-colors border ${focus.includes(a) ? 'bg-army-tan border-army-tan text-army-text' : 'bg-surface border-border text-army-muted hover:text-army-text'}`}>
                    <span className="mr-1.5">{focus.includes(a) ? '■' : '□'}</span>{a.split(' (')[0]}
                  </button>
                ))}
              </div>
            </div>

            {/* Prepare button */}
            <button onClick={handlePrepare} disabled={preparing}
              className="w-full bg-surface border border-army-gold text-army-gold hover:bg-army-gold hover:text-bg disabled:opacity-50 font-mono text-sm tracking-wider uppercase py-3 transition-colors mb-6">
              {preparing ? 'PREPARING SESSION...' : '★ PREPARE TALKING POINTS'}
            </button>

            {/* Talking points output */}
            {(talkingPoints || preparing) && (
              <div className="bg-surface border border-army-gold p-5 mb-6">
                <div className="font-mono text-[10px] tracking-widest text-army-gold uppercase mb-3">
                  Session Preparation — {selected.rank} {selected.last_name}
                </div>
                <div className="font-mono text-sm text-army-text whitespace-pre-wrap leading-relaxed">
                  {talkingPoints.split('\n').map((line, i) => {
                    if (line.startsWith('## '))
                      return <div key={i} className="text-army-gold font-bold mt-4 mb-1 first:mt-0">{line.replace('## ', '')}</div>;
                    if (line.startsWith('**') && line.endsWith('**'))
                      return <div key={i} className="text-army-text font-bold mt-2">{line.replace(/\*\*/g, '')}</div>;
                    return <div key={i}>{line}</div>;
                  })}
                  {preparing && <span className="inline-block w-2 h-4 bg-army-gold ml-0.5 animate-pulse align-text-bottom" />}
                </div>
              </div>
            )}

            {/* Log session form */}
            {showForm && (
              <div className="border border-border p-5 mb-6 space-y-4">
                <div className="font-mono text-xs tracking-widest text-army-gold uppercase">Log Session</div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Session Date</label>
                    <input type="date" value={sessionDate} onChange={e => setSessionDate(e.target.value)}
                      className="w-full bg-surface border border-border px-3 py-2 font-mono text-sm text-army-text focus:outline-none focus:border-army-tan" />
                  </div>
                  <div>
                    <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Next Session</label>
                    <input type="date" value={nextDate} onChange={e => setNextDate(e.target.value)}
                      className="w-full bg-surface border border-border px-3 py-2 font-mono text-sm text-army-text focus:outline-none focus:border-army-tan" />
                  </div>
                </div>

                <div>
                  <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Session Notes</label>
                  <textarea rows={4} value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder="What was discussed, soldier's responses, observations..."
                    className="w-full bg-surface border border-border px-3 py-2 font-mono text-sm text-army-text placeholder-army-muted focus:outline-none focus:border-army-tan resize-none" />
                </div>

                {/* Follow-up actions */}
                <div>
                  <div className="font-mono text-[10px] tracking-widest text-army-muted uppercase mb-2">Follow-Up Actions</div>
                  {followUps.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 mb-1.5">
                      <div className="flex-1 bg-surface border border-border px-3 py-1.5 font-mono text-xs text-army-text">{f.action}</div>
                      {f.due_date && <div className="font-mono text-[10px] text-army-muted">{f.due_date}</div>}
                      <button onClick={() => setFollowUps(fu => fu.filter((_, j) => j !== i))}
                        className="font-mono text-xs text-army-muted hover:text-danger px-2">✕</button>
                    </div>
                  ))}
                  <div className="flex gap-2 mt-2">
                    <input value={newAction} onChange={e => setNewAction(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addFollowUp()}
                      placeholder="Action item..."
                      className="flex-1 bg-surface border border-border px-3 py-2 font-mono text-xs text-army-text placeholder-army-muted focus:outline-none focus:border-army-tan" />
                    <input type="date" value={newDue} onChange={e => setNewDue(e.target.value)}
                      className="w-36 bg-surface border border-border px-3 py-2 font-mono text-xs text-army-text focus:outline-none focus:border-army-tan" />
                    <button onClick={addFollowUp} className="bg-surface border border-border hover:border-army-tan font-mono text-xs text-army-muted hover:text-army-text px-3 py-2 transition-colors">
                      + ADD
                    </button>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={saveSession} disabled={saving}
                    className="bg-army-tan hover:bg-[#9e8562] disabled:opacity-50 text-army-text font-mono text-xs tracking-widest uppercase px-5 py-2.5 transition-colors">
                    {saving ? 'SAVING...' : 'SAVE SESSION'}
                  </button>
                  <button onClick={() => setShowForm(false)}
                    className="border border-border font-mono text-xs tracking-widest uppercase px-5 py-2.5 text-army-muted hover:text-army-text transition-colors">
                    CANCEL
                  </button>
                </div>
              </div>
            )}

            {/* Past sessions */}
            {sessions.length > 0 && (
              <div>
                <div className="font-mono text-[10px] tracking-widest text-army-muted uppercase mb-3">Session History</div>
                <div className="space-y-2">
                  {sessions.map(s => (
                    <div key={s.id} className="bg-surface border border-border p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-mono text-xs text-army-gold">
                          {new Date(s.session_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </div>
                        {s.next_session_date && (
                          <div className="font-mono text-[10px] text-army-muted">
                            Next: {new Date(s.next_session_date).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                      {s.nco_notes && (
                        <div className="font-mono text-xs text-army-text mt-1 whitespace-pre-wrap">{s.nco_notes}</div>
                      )}
                      {s.follow_up_actions?.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-border">
                          <div className="font-mono text-[10px] text-army-muted uppercase mb-1">Follow-Ups</div>
                          {s.follow_up_actions.map((f, i) => (
                            <div key={i} className="font-mono text-xs text-army-muted">
                              {f.complete ? '✓' : '○'} {f.action}
                              {f.due_date ? ` — ${f.due_date}` : ''}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
