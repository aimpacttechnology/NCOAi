import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getPromotionAdvice } from '../lib/api';
import { calcScore, AWARDS_CATALOG, type PromotionData } from '../lib/promotionScore';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Soldier {
  id: string;
  first_name: string;
  last_name: string;
  rank: string;
  mos: string | null;
}

// ─── Constants / Helpers ──────────────────────────────────────────────────────

const TARGET_RANKS = ['SGT', 'SSG', 'SFC', 'MSG', '1SG', 'SGM'];
const DEGREES = ['None', 'Some College', 'Associate', 'Bachelor', 'Master or higher'];

function blankForm(soldier_id: string, nco_id: string): PromotionData {
  return {
    soldier_id, nco_id,
    target_rank: 'SGT',
    tis_months: 0, tig_months: 0,
    acft_score: 0, weapons_qual: 'Unqualified',
    wlc_complete: false, alc_complete: false, slc_complete: false,
    awards: {}, degree: 'None', college_credits: 0, extra_courses: 0,
    custom_points: [],
  };
}

function StatusBadge({ status }: { status: 'GREEN' | 'AMBER' | 'RED' }) {
  const styles = {
    GREEN: 'bg-green-900 text-green-300 border-green-700',
    AMBER: 'bg-yellow-900 text-yellow-300 border-yellow-700',
    RED:   'bg-red-900 text-danger border-danger',
  };
  return (
    <span className={`font-mono text-[10px] tracking-widest uppercase px-2 py-0.5 border ${styles[status]}`}>
      {status}
    </span>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function PromotionReadiness() {
  const [soldiers, setSoldiers]   = useState<Soldier[]>([]);
  const [promoMap, setPromoMap]   = useState<Record<string, PromotionData>>({});
  const [selected, setSelected]   = useState<Soldier | null>(null);
  const [form, setForm]           = useState<PromotionData | null>(null);
  const [saving, setSaving]       = useState(false);
  const [advice, setAdvice]       = useState('');
  const [advising, setAdvising]   = useState(false);
  const [userId, setUserId]       = useState('');
  const [loading, setLoading]     = useState(true);

  // Custom category input state
  const [newLabel,  setNewLabel]  = useState('');
  const [newPoints, setNewPoints] = useState('');

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const [{ data: soldiersData }, { data: promoData }] = await Promise.all([
        supabase.from('soldiers').select('id, first_name, last_name, rank, mos').eq('nco_id', user.id).order('last_name'),
        supabase.from('promotion_data').select('*').eq('nco_id', user.id),
      ]);

      if (soldiersData) setSoldiers(soldiersData);
      if (promoData) {
        const map: Record<string, PromotionData> = {};
        promoData.forEach((p: PromotionData) => {
          map[p.soldier_id] = { ...p, custom_points: p.custom_points ?? [] };
        });
        setPromoMap(map);
      }
      setLoading(false);
    };
    load();
  }, []);

  const openSoldier = (s: Soldier) => {
    setSelected(s);
    setAdvice('');
    setNewLabel('');
    setNewPoints('');
    const existing = promoMap[s.id];
    setForm(existing ? { ...existing, custom_points: existing.custom_points ?? [] } : blankForm(s.id, userId));
  };

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    const payload = { ...form, nco_id: userId };

    const { data, error } = form.id
      ? await supabase.from('promotion_data').update(payload).eq('id', form.id).select().single()
      : await supabase.from('promotion_data').insert(payload).select().single();

    if (!error && data) {
      const saved = { ...data, custom_points: data.custom_points ?? [] };
      setForm(saved);
      setPromoMap(m => ({ ...m, [form.soldier_id]: saved }));
    }
    setSaving(false);
  };

  const handleGetAdvice = async () => {
    if (!form || !selected) return;
    const { total, maxScore, breakdown, status, gaps, prereqsMet } = calcScore(form);
    setAdvice('');
    setAdvising(true);
    try {
      await getPromotionAdvice(
        {
          soldier: { name: `${selected.last_name}, ${selected.first_name}`, rank: selected.rank },
          targetRank: form.target_rank,
          ...form,
          score: total, maxScore, breakdown, status, gaps, prereqsMet,
        },
        chunk => setAdvice(prev => prev + chunk)
      );
    } catch {
      setAdvice('Failed to get advice. Check server connection.');
    } finally {
      setAdvising(false);
    }
  };

  const setField = <K extends keyof PromotionData>(key: K, value: PromotionData[K]) =>
    setForm(f => f ? { ...f, [key]: value } : f);

  const setAward = (key: string, count: number) =>
    setForm(f => f ? { ...f, awards: { ...f.awards, [key]: count } } : f);

  const addCustom = () => {
    const pts = parseInt(newPoints, 10);
    if (!newLabel.trim() || isNaN(pts) || pts < 0) return;
    setForm(f => f ? { ...f, custom_points: [...(f.custom_points ?? []), { label: newLabel.trim(), points: pts }] } : f);
    setNewLabel('');
    setNewPoints('');
  };

  const removeCustom = (i: number) =>
    setForm(f => f ? { ...f, custom_points: f.custom_points.filter((_, idx) => idx !== i) } : f);

  const scoreData = form ? calcScore(form) : null;
  const fixedCategories = ['Military Training', 'Awards', 'Military Education', 'Civilian Education'];

  return (
    <div className="flex h-full">
      {/* ── Soldier list ── */}
      <div className="w-72 flex-shrink-0 border-r border-border flex flex-col">
        <div className="px-5 py-4 border-b border-border">
          <div className="font-mono text-[10px] tracking-widest text-army-muted uppercase">Phase 2</div>
          <div className="font-mono text-sm font-bold text-army-text mt-0.5">Promotion Readiness</div>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {loading ? (
            <div className="px-5 py-4 font-mono text-xs text-army-muted">Loading...</div>
          ) : soldiers.length === 0 ? (
            <div className="px-5 py-4 font-mono text-xs text-army-muted">No soldiers on roster.</div>
          ) : soldiers.map(s => {
            const sc = promoMap[s.id] ? calcScore(promoMap[s.id]) : null;
            return (
              <button key={s.id} onClick={() => openSoldier(s)}
                className={`w-full text-left px-5 py-3 border-b border-border transition-colors ${selected?.id === s.id ? 'bg-army-tan' : 'hover:bg-[#21262d]'}`}>
                <div className="font-mono text-xs font-bold text-army-text">{s.rank} {s.last_name}, {s.first_name}</div>
                <div className="flex items-center gap-2 mt-1">
                  {sc ? (
                    <><StatusBadge status={sc.status} /><span className="font-mono text-[10px] text-army-muted">{sc.total}/{sc.maxScore} pts</span></>
                  ) : (
                    <span className="font-mono text-[10px] text-army-muted">Not assessed</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Detail panel ── */}
      <div className="flex-1 overflow-y-auto">
        {!selected || !form ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="font-mono text-4xl text-army-muted mb-3">★</div>
              <div className="font-mono text-sm text-army-muted">Select a soldier to assess promotion readiness</div>
            </div>
          </div>
        ) : (
          <div className="p-8 max-w-3xl">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="font-mono text-army-gold text-lg font-bold">{selected.rank} {selected.last_name}, {selected.first_name}</div>
                <div className="font-mono text-xs text-army-muted mt-0.5">MOS: {selected.mos || '—'}</div>
              </div>
              {scoreData && (
                <div className="text-right">
                  <StatusBadge status={scoreData.status} />
                  <div className="font-mono text-2xl font-bold text-army-gold mt-1">
                    {scoreData.total}<span className="text-army-muted text-sm">/{scoreData.maxScore}</span>
                  </div>
                  <div className="font-mono text-[10px] text-army-muted">PROMOTION POINTS</div>
                </div>
              )}
            </div>

            {/* Score breakdown */}
            {scoreData && (
              <div className="bg-surface border border-border p-4 mb-6 space-y-2">
                {Object.entries(scoreData.breakdown).map(([cat, { earned, max }]) => (
                  <div key={cat}>
                    <div className="flex justify-between font-mono text-[10px] text-army-muted mb-1">
                      <span className={fixedCategories.includes(cat) ? '' : 'text-army-gold'}>{cat}</span>
                      <span>{earned}/{max}</span>
                    </div>
                    <div className="h-1.5 bg-border">
                      <div className="h-full bg-army-gold transition-all" style={{ width: `${max > 0 ? Math.round((earned / max) * 100) : 0}%` }} />
                    </div>
                  </div>
                ))}
                {scoreData.gaps.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="font-mono text-[10px] tracking-widest text-danger uppercase mb-1">Eligibility Gaps</div>
                    {scoreData.gaps.map((g, i) => <div key={i} className="font-mono text-xs text-danger">• {g}</div>)}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-6">
              {/* Target rank + time */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Target Rank</label>
                  <select value={form.target_rank} onChange={e => setField('target_rank', e.target.value)}
                    className="w-full bg-surface border border-border px-3 py-2 font-mono text-sm text-army-text focus:outline-none focus:border-army-tan">
                    {TARGET_RANKS.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">TIS (months)</label>
                  <input type="number" min={0} value={form.tis_months} onChange={e => setField('tis_months', +e.target.value)}
                    className="w-full bg-surface border border-border px-3 py-2 font-mono text-sm text-army-text focus:outline-none focus:border-army-tan" />
                </div>
                <div>
                  <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">TIG (months)</label>
                  <input type="number" min={0} value={form.tig_months} onChange={e => setField('tig_months', +e.target.value)}
                    className="w-full bg-surface border border-border px-3 py-2 font-mono text-sm text-army-text focus:outline-none focus:border-army-tan" />
                </div>
              </div>

              {/* Physical */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">ACFT Score (max 600)</label>
                  <input type="number" min={0} max={600} value={form.acft_score}
                    onChange={e => setField('acft_score', Math.min(600, +e.target.value))}
                    className="w-full bg-surface border border-border px-3 py-2 font-mono text-sm text-army-text focus:outline-none focus:border-army-tan" />
                </div>
                <div>
                  <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Weapons Qualification</label>
                  <select value={form.weapons_qual} onChange={e => setField('weapons_qual', e.target.value)}
                    className="w-full bg-surface border border-border px-3 py-2 font-mono text-sm text-army-text focus:outline-none focus:border-army-tan">
                    {['Expert', 'Sharpshooter', 'Marksman', 'Unqualified', 'N/A'].map(q => <option key={q}>{q}</option>)}
                  </select>
                </div>
              </div>

              {/* Military education */}
              <div>
                <div className="font-mono text-[10px] tracking-widest text-army-muted uppercase mb-2">Military Education</div>
                <div className="grid grid-cols-2 gap-3">
                  {(['wlc_complete', 'alc_complete', 'slc_complete'] as const).map(key => (
                    <button key={key} onClick={() => setField(key, !form[key])}
                      className={`px-3 py-2.5 font-mono text-xs text-left transition-colors border ${form[key] ? 'bg-army-tan border-army-tan text-army-text' : 'bg-surface border-border text-army-muted hover:text-army-text'}`}>
                      <span className="mr-2">{form[key] ? '■' : '□'}</span>
                      {key === 'wlc_complete' ? 'WLC Complete' : key === 'alc_complete' ? 'ALC Complete' : 'SLC Complete'}
                    </button>
                  ))}
                  <div>
                    <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Extra Courses</label>
                    <input type="number" min={0} value={form.extra_courses} onChange={e => setField('extra_courses', +e.target.value)}
                      className="w-full bg-surface border border-border px-3 py-2 font-mono text-sm text-army-text focus:outline-none focus:border-army-tan" />
                  </div>
                </div>
              </div>

              {/* Awards */}
              <div>
                <div className="font-mono text-[10px] tracking-widest text-army-muted uppercase mb-2">Awards</div>
                <div className="space-y-2">
                  {AWARDS_CATALOG.map(a => (
                    <div key={a.key} className="flex items-center justify-between bg-surface border border-border px-3 py-2">
                      <div>
                        <span className="font-mono text-xs text-army-text">{a.label}</span>
                        <span className="font-mono text-[10px] text-army-muted ml-2">+{a.points} pts each</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setAward(a.key, Math.max(0, (form.awards[a.key] ?? 0) - 1))}
                          className="w-6 h-6 font-mono text-army-muted hover:text-army-text border border-border hover:border-army-tan transition-colors">−</button>
                        <span className="font-mono text-sm text-army-gold w-4 text-center">{form.awards[a.key] ?? 0}</span>
                        <button onClick={() => setAward(a.key, (form.awards[a.key] ?? 0) + 1)}
                          className="w-6 h-6 font-mono text-army-muted hover:text-army-text border border-border hover:border-army-tan transition-colors">+</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Civilian education */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Highest Degree</label>
                  <select value={form.degree} onChange={e => setField('degree', e.target.value)}
                    className="w-full bg-surface border border-border px-3 py-2 font-mono text-sm text-army-text focus:outline-none focus:border-army-tan">
                    {DEGREES.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">College Credits</label>
                  <input type="number" min={0} value={form.college_credits} onChange={e => setField('college_credits', +e.target.value)}
                    className="w-full bg-surface border border-border px-3 py-2 font-mono text-sm text-army-text focus:outline-none focus:border-army-tan" />
                </div>
              </div>

              {/* ── Custom Scoring Categories ── */}
              <div>
                <div className="font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Custom Scoring Categories</div>
                <div className="font-mono text-[10px] text-army-muted mb-3">
                  Add anything not in the standard list — weapons quals, unit badges, language certs, MOS-specific creds, etc.
                </div>

                {/* Existing custom entries */}
                {form.custom_points.length > 0 && (
                  <div className="space-y-1.5 mb-3">
                    {form.custom_points.map((c, i) => (
                      <div key={i} className="flex items-center justify-between bg-surface border border-army-tan px-3 py-2">
                        <div>
                          <span className="font-mono text-xs text-army-text">{c.label}</span>
                          <span className="font-mono text-[10px] text-army-gold ml-2">+{c.points} pts</span>
                        </div>
                        <button onClick={() => removeCustom(i)}
                          className="font-mono text-xs text-army-muted hover:text-danger transition-colors px-2">
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add new entry */}
                <div className="flex gap-2">
                  <input
                    value={newLabel}
                    onChange={e => setNewLabel(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addCustom()}
                    placeholder="Category name (e.g. Pistol Qual - Expert)"
                    className="flex-1 bg-surface border border-border px-3 py-2 font-mono text-sm text-army-text placeholder-army-muted focus:outline-none focus:border-army-tan"
                  />
                  <input
                    type="number"
                    min={0}
                    value={newPoints}
                    onChange={e => setNewPoints(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addCustom()}
                    placeholder="Pts"
                    className="w-20 bg-surface border border-border px-3 py-2 font-mono text-sm text-army-text placeholder-army-muted focus:outline-none focus:border-army-tan"
                  />
                  <button onClick={addCustom} disabled={!newLabel.trim() || !newPoints}
                    className="bg-army-tan hover:bg-[#9e8562] disabled:opacity-40 text-army-text font-mono text-xs tracking-widest uppercase px-4 py-2 transition-colors">
                    + ADD
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button onClick={handleSave} disabled={saving}
                  className="bg-army-tan hover:bg-[#9e8562] disabled:opacity-50 text-army-text font-mono text-xs tracking-widest uppercase px-5 py-2.5 transition-colors">
                  {saving ? 'SAVING...' : 'SAVE'}
                </button>
                <button onClick={handleGetAdvice} disabled={advising}
                  className="border border-army-gold text-army-gold hover:bg-army-gold hover:text-bg disabled:opacity-50 font-mono text-xs tracking-widest uppercase px-5 py-2.5 transition-colors">
                  {advising ? 'ANALYZING...' : '★ GET AI RECOMMENDATIONS'}
                </button>
              </div>
            </div>

            {/* AI Recommendations */}
            {(advice || advising) && (
              <div className="mt-6 bg-surface border border-army-gold p-5">
                <div className="font-mono text-[10px] tracking-widest text-army-gold uppercase mb-3">
                  Senior NCO Advisor — Promotion Recommendations
                </div>
                <div className="font-mono text-sm text-army-text whitespace-pre-wrap leading-relaxed">
                  {advice}
                  {advising && <span className="inline-block w-2 h-4 bg-army-gold ml-0.5 animate-pulse align-text-bottom" />}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
