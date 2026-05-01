import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getPromotionAdvice } from '../lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Soldier {
  id: string;
  first_name: string;
  last_name: string;
  rank: string;
  mos: string | null;
}

interface PromotionData {
  id?: string;
  soldier_id: string;
  nco_id: string;
  target_rank: string;
  tis_months: number;
  tig_months: number;
  acft_score: number;
  weapons_qual: string;
  wlc_complete: boolean;
  alc_complete: boolean;
  slc_complete: boolean;
  awards: Record<string, number>;
  degree: string;
  college_credits: number;
  extra_courses: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TARGET_RANKS = ['SGT', 'SSG', 'SFC', 'MSG', '1SG', 'SGM'];

const AWARDS_CATALOG: { key: string; label: string; points: number }[] = [
  { key: 'BSM',   label: 'Bronze Star Medal (BSM)',          points: 30 },
  { key: 'PH',    label: 'Purple Heart (PH)',                 points: 30 },
  { key: 'MSM',   label: 'Meritorious Service Medal (MSM)',   points: 25 },
  { key: 'ARCOM', label: 'Army Commendation Medal (ARCOM)',   points: 20 },
  { key: 'AAM',   label: 'Army Achievement Medal (AAM)',      points: 10 },
  { key: 'GCM',   label: 'Good Conduct Medal (GCM)',          points: 10 },
];

const DEGREES = ['None', 'Some College', 'Associate', 'Bachelor', 'Master or higher'];

const PREREQS: Record<string, { tis: number; tig: number; wlc: boolean; alc: boolean; slc: boolean }> = {
  SGT: { tis: 18,  tig: 8,  wlc: true,  alc: false, slc: false },
  SSG: { tis: 48,  tig: 12, wlc: true,  alc: false, slc: false },
  SFC: { tis: 84,  tig: 36, wlc: true,  alc: true,  slc: false },
  MSG: { tis: 144, tig: 36, wlc: true,  alc: true,  slc: true  },
  '1SG':{ tis: 144,tig: 36, wlc: true,  alc: true,  slc: true  },
  SGM: { tis: 192, tig: 36, wlc: true,  alc: true,  slc: true  },
};

// ─── Score engine ─────────────────────────────────────────────────────────────

function calcScore(d: PromotionData) {
  const breakdown: Record<string, { earned: number; max: number }> = {
    'Military Training': { earned: 0, max: 100 },
    Awards:              { earned: 0, max: 125 },
    'Military Education':{ earned: 0, max: 200 },
    'Civilian Education':{ earned: 0, max: 75  },
  };

  // Military Training
  const acftPts  = Math.min(60, Math.floor(d.acft_score / 10));
  const weapPts  = { Expert: 40, Sharpshooter: 30, Marksman: 15, Unqualified: 0 }[d.weapons_qual] ?? 0;
  breakdown['Military Training'].earned = Math.min(100, acftPts + weapPts);

  // Awards
  let awardTotal = 0;
  for (const a of AWARDS_CATALOG) {
    awardTotal += (d.awards[a.key] ?? 0) * a.points;
  }
  breakdown['Awards'].earned = Math.min(125, awardTotal);

  // Military Education
  const eduPts = (d.wlc_complete ? 80 : 0) + (d.alc_complete ? 80 : 0) + (d.slc_complete ? 40 : 0)
    + Math.min(40, d.extra_courses * 10);
  breakdown['Military Education'].earned = Math.min(200, eduPts);

  // Civilian Education
  const degPts = { None: 0, 'Some College': 10, Associate: 40, Bachelor: 75, 'Master or higher': 75 }[d.degree] ?? 0;
  const creditPts = Math.min(25, Math.floor(d.college_credits * 0.5));
  breakdown['Civilian Education'].earned = Math.min(75, Math.max(degPts, creditPts));

  const total   = Object.values(breakdown).reduce((s, v) => s + v.earned, 0);
  const maxScore = Object.values(breakdown).reduce((s, v) => s + v.max, 0); // 500

  // Prerequisites check
  const req = PREREQS[d.target_rank];
  const gaps: string[] = [];
  if (req) {
    if (d.tis_months < req.tis) gaps.push(`TIS: need ${req.tis} months, have ${d.tis_months}`);
    if (d.tig_months < req.tig) gaps.push(`TIG: need ${req.tig} months, have ${d.tig_months}`);
    if (req.wlc && !d.wlc_complete) gaps.push('WLC not complete (required)');
    if (req.alc && !d.alc_complete) gaps.push('ALC not complete (required)');
    if (req.slc && !d.slc_complete) gaps.push('SLC not complete (required)');
  }
  const prereqsMet = gaps.length === 0;

  const pct = total / maxScore;
  let status: 'GREEN' | 'AMBER' | 'RED';
  if (!prereqsMet || pct < 0.4)      status = 'RED';
  else if (pct < 0.65)               status = 'AMBER';
  else                               status = 'GREEN';

  return { total, maxScore, breakdown, status, gaps, prereqsMet };
}

// ─── Blank form factory ───────────────────────────────────────────────────────

function blankForm(soldier_id: string, nco_id: string): PromotionData {
  return {
    soldier_id, nco_id,
    target_rank: 'SGT',
    tis_months: 0, tig_months: 0,
    acft_score: 0, weapons_qual: 'Unqualified',
    wlc_complete: false, alc_complete: false, slc_complete: false,
    awards: {}, degree: 'None', college_credits: 0, extra_courses: 0,
  };
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: 'GREEN' | 'AMBER' | 'RED' }) {
  const styles = {
    GREEN: 'bg-green-900 text-green-300 border-green-700',
    AMBER: 'bg-yellow-900 text-yellow-300 border-yellow-700',
    RED:   'bg-red-900   text-danger      border-danger',
  };
  return (
    <span className={`font-mono text-[10px] tracking-widest uppercase px-2 py-0.5 border ${styles[status]}`}>
      {status}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PromotionReadiness() {
  const [soldiers, setSoldiers] = useState<Soldier[]>([]);
  const [promoMap, setPromoMap] = useState<Record<string, PromotionData>>({});
  const [selected, setSelected] = useState<Soldier | null>(null);
  const [form, setForm] = useState<PromotionData | null>(null);
  const [saving, setSaving] = useState(false);
  const [advice, setAdvice] = useState('');
  const [advising, setAdvising] = useState(false);
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(true);

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
        promoData.forEach((p: PromotionData) => { map[p.soldier_id] = p; });
        setPromoMap(map);
      }
      setLoading(false);
    };
    load();
  }, []);

  const openSoldier = (s: Soldier) => {
    setSelected(s);
    setAdvice('');
    const existing = promoMap[s.id];
    setForm(existing ?? blankForm(s.id, userId));
  };

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    const payload = { ...form, nco_id: userId };

    const { data, error } = form.id
      ? await supabase.from('promotion_data').update(payload).eq('id', form.id).select().single()
      : await supabase.from('promotion_data').insert(payload).select().single();

    if (!error && data) {
      setForm(data);
      setPromoMap(m => ({ ...m, [form.soldier_id]: data }));
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

  const scoreData = form ? calcScore(form) : null;

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
          ) : (
            soldiers.map(s => {
              const existing = promoMap[s.id];
              const sc = existing ? calcScore(existing) : null;
              const isActive = selected?.id === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => openSoldier(s)}
                  className={`w-full text-left px-5 py-3 border-b border-border transition-colors ${
                    isActive ? 'bg-army-tan' : 'hover:bg-[#21262d]'
                  }`}
                >
                  <div className="font-mono text-xs font-bold text-army-text">
                    {s.rank} {s.last_name}, {s.first_name}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {sc ? (
                      <>
                        <StatusBadge status={sc.status} />
                        <span className="font-mono text-[10px] text-army-muted">
                          {sc.total}/{sc.maxScore} pts
                        </span>
                      </>
                    ) : (
                      <span className="font-mono text-[10px] text-army-muted">Not assessed</span>
                    )}
                  </div>
                </button>
              );
            })
          )}
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
                <div className="font-mono text-army-gold text-lg font-bold">
                  {selected.rank} {selected.last_name}, {selected.first_name}
                </div>
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

            {/* Score breakdown bar */}
            {scoreData && (
              <div className="bg-surface border border-border p-4 mb-6 space-y-2">
                {Object.entries(scoreData.breakdown).map(([cat, { earned, max }]) => (
                  <div key={cat}>
                    <div className="flex justify-between font-mono text-[10px] text-army-muted mb-1">
                      <span>{cat}</span>
                      <span>{earned}/{max}</span>
                    </div>
                    <div className="h-1.5 bg-border">
                      <div
                        className="h-full bg-army-gold transition-all"
                        style={{ width: `${Math.round((earned / max) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
                {scoreData.gaps.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="font-mono text-[10px] tracking-widest text-danger uppercase mb-1">Eligibility Gaps</div>
                    {scoreData.gaps.map((g, i) => (
                      <div key={i} className="font-mono text-xs text-danger">• {g}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Form */}
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
                  <input type="number" min={0} value={form.tis_months}
                    onChange={e => setField('tis_months', +e.target.value)}
                    className="w-full bg-surface border border-border px-3 py-2 font-mono text-sm text-army-text focus:outline-none focus:border-army-tan" />
                </div>
                <div>
                  <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">TIG (months)</label>
                  <input type="number" min={0} value={form.tig_months}
                    onChange={e => setField('tig_months', +e.target.value)}
                    className="w-full bg-surface border border-border px-3 py-2 font-mono text-sm text-army-text focus:outline-none focus:border-army-tan" />
                </div>
              </div>

              {/* Physical */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">
                    ACFT Score <span className="text-army-muted normal-case">(max 600)</span>
                  </label>
                  <input type="number" min={0} max={600} value={form.acft_score}
                    onChange={e => setField('acft_score', Math.min(600, +e.target.value))}
                    className="w-full bg-surface border border-border px-3 py-2 font-mono text-sm text-army-text focus:outline-none focus:border-army-tan" />
                </div>
                <div>
                  <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Weapons Qualification</label>
                  <select value={form.weapons_qual} onChange={e => setField('weapons_qual', e.target.value)}
                    className="w-full bg-surface border border-border px-3 py-2 font-mono text-sm text-army-text focus:outline-none focus:border-army-tan">
                    {['Expert', 'Sharpshooter', 'Marksman', 'Unqualified'].map(q => <option key={q}>{q}</option>)}
                  </select>
                </div>
              </div>

              {/* Military education */}
              <div>
                <div className="font-mono text-[10px] tracking-widest text-army-muted uppercase mb-2">Military Education</div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'wlc_complete', label: 'WLC Complete' },
                    { key: 'alc_complete', label: 'ALC Complete' },
                    { key: 'slc_complete', label: 'SLC Complete' },
                  ].map(({ key, label }) => (
                    <button key={key}
                      onClick={() => setField(key as keyof PromotionData, !form[key as keyof PromotionData] as PromotionData[keyof PromotionData])}
                      className={`px-3 py-2.5 font-mono text-xs text-left transition-colors border ${
                        form[key as keyof PromotionData]
                          ? 'bg-army-tan border-army-tan text-army-text'
                          : 'bg-surface border-border text-army-muted hover:text-army-text'
                      }`}>
                      <span className="mr-2">{form[key as keyof PromotionData] ? '■' : '□'}</span>{label}
                    </button>
                  ))}
                  <div>
                    <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Extra Courses</label>
                    <input type="number" min={0} value={form.extra_courses}
                      onChange={e => setField('extra_courses', +e.target.value)}
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
                          className="w-6 h-6 font-mono text-army-muted hover:text-army-text border border-border hover:border-army-tan transition-colors">
                          −
                        </button>
                        <span className="font-mono text-sm text-army-gold w-4 text-center">
                          {form.awards[a.key] ?? 0}
                        </span>
                        <button onClick={() => setAward(a.key, (form.awards[a.key] ?? 0) + 1)}
                          className="w-6 h-6 font-mono text-army-muted hover:text-army-text border border-border hover:border-army-tan transition-colors">
                          +
                        </button>
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
                  <input type="number" min={0} value={form.college_credits}
                    onChange={e => setField('college_credits', +e.target.value)}
                    className="w-full bg-surface border border-border px-3 py-2 font-mono text-sm text-army-text focus:outline-none focus:border-army-tan" />
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
                  {advising && (
                    <span className="inline-block w-2 h-4 bg-army-gold ml-0.5 animate-pulse align-text-bottom" />
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
