import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { generateDevelopmentPlan } from '../lib/api';
import { calcScore, type PromotionData } from '../lib/promotionScore';

interface Soldier { id: string; first_name: string; last_name: string; rank: string }
interface Counseling { id: string; type: string; generated_output: string | null; created_at: string }
interface Plan {
  id: string; soldier_id: string; counseling_id: string | null;
  plan_type: string; period_start: string; period_end: string;
  ai_plan: string | null; status: string; created_at: string;
  soldiers?: { rank: string; first_name: string; last_name: string };
}

const PLAN_LABELS: Record<string, { label: string; months: number }> = {
  initial:      { label: 'Initial (90-Day)',   months: 3  },
  'semi-annual':{ label: 'Semi-Annual (6-Mo)', months: 6  },
  annual:       { label: 'Annual (12-Mo)',      months: 12 },
};

export default function DevelopmentPlans() {
  const [soldiers, setSoldiers]     = useState<Soldier[]>([]);
  const [plans, setPlans]           = useState<Plan[]>([]);
  const [selected, setSelected]     = useState<Plan | null>(null);
  const [showNew, setShowNew]       = useState(false);
  const [counselings, setCounselings] = useState<Counseling[]>([]);
  const [promoMap, setPromoMap]     = useState<Record<string, PromotionData>>({});
  const [form, setForm]             = useState({
    soldier_id: '', counseling_id: '', plan_type: 'initial',
    period_start: new Date().toISOString().split('T')[0],
  });
  const [output, setOutput]         = useState('');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [userId, setUserId]         = useState('');
  const [loading, setLoading]       = useState(true);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const [solRes, planRes, promoRes] = await Promise.all([
      supabase.from('soldiers').select('id, first_name, last_name, rank').eq('nco_id', user.id).order('last_name'),
      supabase.from('development_plans').select('*, soldiers(rank, first_name, last_name)').eq('nco_id', user.id).order('created_at', { ascending: false }),
      supabase.from('promotion_data').select('*').eq('nco_id', user.id),
    ]);

    if (solRes.data) setSoldiers(solRes.data);
    if (planRes.data) setPlans(planRes.data as Plan[]);
    if (promoRes.data) {
      const map: Record<string, PromotionData> = {};
      promoRes.data.forEach((p: PromotionData) => { map[p.soldier_id] = { ...p, custom_points: p.custom_points ?? [] }; });
      setPromoMap(map);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const onSoldierChange = async (sid: string) => {
    setForm(f => ({ ...f, soldier_id: sid, counseling_id: '' }));
    if (!sid) { setCounselings([]); return; }
    const { data } = await supabase.from('counselings').select('id, type, generated_output, created_at')
      .eq('soldier_id', sid).order('created_at', { ascending: false });
    setCounselings(data ?? []);
  };

  const periodEnd = (start: string, months: number) => {
    const d = new Date(start);
    d.setMonth(d.getMonth() + months);
    return d.toISOString().split('T')[0];
  };

  const handleGenerate = async () => {
    const soldier = soldiers.find(s => s.id === form.soldier_id);
    const counseling = counselings.find(c => c.id === form.counseling_id);
    if (!soldier || !counseling) return;

    const promo = promoMap[soldier.id];
    const scoreData = promo ? calcScore(promo) : null;
    const months = PLAN_LABELS[form.plan_type]?.months ?? 3;

    setGenerating(true);
    setOutput('');
    try {
      await generateDevelopmentPlan(
        {
          soldier: { name: `${soldier.first_name} ${soldier.last_name}`, rank: soldier.rank },
          counselingType: counseling.type,
          counselingContent: counseling.generated_output ?? 'No content available',
          promotionData: scoreData ? {
            target_rank: promo!.target_rank,
            status: scoreData.status,
            gaps: scoreData.gaps,
          } : undefined,
          planType: form.plan_type,
        },
        chunk => setOutput(p => p + chunk)
      );
      setForm(f => ({ ...f, period_end: periodEnd(f.period_start, months) }));
    } catch {
      setOutput('Generation failed. Check server connection.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!output || !form.soldier_id || !userId) return;
    setSaving(true);
    const months = PLAN_LABELS[form.plan_type]?.months ?? 3;
    const end = periodEnd(form.period_start, months);

    // Supersede any existing active plan for this soldier
    await supabase.from('development_plans')
      .update({ status: 'superseded' })
      .eq('soldier_id', form.soldier_id)
      .eq('status', 'active');

    const { data } = await supabase.from('development_plans').insert({
      soldier_id: form.soldier_id,
      nco_id: userId,
      counseling_id: form.counseling_id || null,
      plan_type: form.plan_type,
      period_start: form.period_start,
      period_end: end,
      ai_plan: output,
      status: 'active',
    }).select('*, soldiers(rank, first_name, last_name)').single();

    if (data) {
      setPlans(p => [data as Plan, ...p]);
      setSelected(data as Plan);
      setShowNew(false);
      setOutput('');
      setForm({ soldier_id: '', counseling_id: '', plan_type: 'initial', period_start: new Date().toISOString().split('T')[0] });
    }
    setSaving(false);
  };

  const activePlans = plans.filter(p => p.status === 'active');
  const pastPlans   = plans.filter(p => p.status !== 'active');

  return (
    <div className="flex h-full">
      {/* ── Plan list ── */}
      <div className="w-72 flex-shrink-0 border-r border-border flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <div className="font-mono text-[10px] tracking-widest text-army-muted uppercase">Step 3</div>
            <div className="font-mono text-sm font-bold text-army-text mt-0.5">Development Plans</div>
          </div>
          <button onClick={() => { setShowNew(true); setSelected(null); }}
            className="bg-army-tan hover:bg-[#9e8562] text-army-text font-mono text-[10px] tracking-widest uppercase px-3 py-1.5 transition-colors">
            + NEW
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {loading ? <div className="px-5 py-4 font-mono text-xs text-army-muted">Loading...</div> : (
            <>
              {activePlans.length > 0 && (
                <>
                  <div className="px-5 py-2 font-mono text-[10px] tracking-widest text-army-muted uppercase">Active</div>
                  {activePlans.map(p => (
                    <button key={p.id} onClick={() => { setSelected(p); setShowNew(false); }}
                      className={`w-full text-left px-5 py-3 border-b border-border transition-colors ${selected?.id === p.id ? 'bg-army-tan' : 'hover:bg-[#21262d]'}`}>
                      <div className="font-mono text-xs font-bold text-army-text">
                        {p.soldiers?.rank} {p.soldiers?.last_name}
                      </div>
                      <div className="font-mono text-[10px] text-army-gold">{PLAN_LABELS[p.plan_type]?.label}</div>
                      <div className="font-mono text-[10px] text-army-muted">
                        {new Date(p.period_start).toLocaleDateString()} – {new Date(p.period_end).toLocaleDateString()}
                      </div>
                    </button>
                  ))}
                </>
              )}
              {pastPlans.length > 0 && (
                <>
                  <div className="px-5 py-2 font-mono text-[10px] tracking-widest text-army-muted uppercase mt-2">Past</div>
                  {pastPlans.map(p => (
                    <button key={p.id} onClick={() => { setSelected(p); setShowNew(false); }}
                      className={`w-full text-left px-5 py-3 border-b border-border transition-colors opacity-60 ${selected?.id === p.id ? 'bg-army-tan opacity-100' : 'hover:bg-[#21262d]'}`}>
                      <div className="font-mono text-xs text-army-text">
                        {p.soldiers?.rank} {p.soldiers?.last_name}
                      </div>
                      <div className="font-mono text-[10px] text-army-muted">{PLAN_LABELS[p.plan_type]?.label} · {p.status}</div>
                    </button>
                  ))}
                </>
              )}
              {plans.length === 0 && (
                <div className="px-5 py-8 text-center font-mono text-xs text-army-muted">
                  No plans yet.<br />Create one from a DA 4856 counseling.
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Detail / New form ── */}
      <div className="flex-1 overflow-y-auto p-8">
        {/* View existing plan */}
        {selected && !showNew && (
          <div className="max-w-3xl">
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="font-mono text-army-gold text-lg font-bold">
                  {selected.soldiers?.rank} {selected.soldiers?.last_name} — {PLAN_LABELS[selected.plan_type]?.label}
                </div>
                <div className="font-mono text-xs text-army-muted mt-0.5">
                  {new Date(selected.period_start).toLocaleDateString()} – {new Date(selected.period_end).toLocaleDateString()}
                  {' · '}<span className={selected.status === 'active' ? 'text-green-400' : 'text-army-muted'}>{selected.status.toUpperCase()}</span>
                </div>
              </div>
            </div>
            <div className="bg-surface border border-border p-6">
              <div className="font-mono text-sm text-army-text whitespace-pre-wrap leading-relaxed">
                {(selected.ai_plan ?? '').split('\n').map((line, i) => {
                  if (line.startsWith('## '))
                    return <div key={i} className="text-army-gold font-bold text-base mt-5 mb-2 first:mt-0">{line.replace('## ', '')}</div>;
                  if (line.startsWith('**') && line.endsWith('**'))
                    return <div key={i} className="text-army-text font-bold mt-3">{line.replace(/\*\*/g, '')}</div>;
                  return <div key={i}>{line}</div>;
                })}
              </div>
            </div>
          </div>
        )}

        {/* New plan form */}
        {showNew && (
          <div className="max-w-3xl">
            <div className="mb-6">
              <div className="font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">New Development Plan</div>
              <div className="font-mono text-xl font-bold text-army-text">DA 4856 → Development Plan</div>
              <div className="font-mono text-xs text-army-muted mt-1">
                Select the soldier and the counseling that drives this plan. The DA 4856 content becomes the foundation.
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Soldier</label>
                  <select value={form.soldier_id} onChange={e => onSoldierChange(e.target.value)}
                    className="w-full bg-surface border border-border px-3 py-2.5 font-mono text-sm text-army-text focus:outline-none focus:border-army-tan">
                    <option value="">-- Select --</option>
                    {soldiers.map(s => <option key={s.id} value={s.id}>{s.rank} {s.last_name}, {s.first_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Plan Type</label>
                  <select value={form.plan_type} onChange={e => setForm(f => ({ ...f, plan_type: e.target.value }))}
                    className="w-full bg-surface border border-border px-3 py-2.5 font-mono text-sm text-army-text focus:outline-none focus:border-army-tan">
                    {Object.entries(PLAN_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Source Counseling (DA 4856)</label>
                  <select value={form.counseling_id} onChange={e => setForm(f => ({ ...f, counseling_id: e.target.value }))}
                    disabled={!form.soldier_id}
                    className="w-full bg-surface border border-border px-3 py-2.5 font-mono text-sm text-army-text focus:outline-none focus:border-army-tan disabled:opacity-50">
                    <option value="">-- Select counseling --</option>
                    {counselings.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.type} — {new Date(c.created_at).toLocaleDateString()}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Plan Start Date</label>
                  <input type="date" value={form.period_start} onChange={e => setForm(f => ({ ...f, period_start: e.target.value }))}
                    className="w-full bg-surface border border-border px-3 py-2.5 font-mono text-sm text-army-text focus:outline-none focus:border-army-tan" />
                </div>
              </div>

              <button onClick={handleGenerate}
                disabled={!form.soldier_id || !form.counseling_id || generating}
                className="w-full bg-army-tan hover:bg-[#9e8562] disabled:opacity-40 disabled:cursor-not-allowed text-army-text font-mono text-sm tracking-wider uppercase py-3 transition-colors">
                {generating ? 'GENERATING PLAN...' : '◈ GENERATE FROM DA 4856'}
              </button>
            </div>

            {/* Generated output */}
            {(output || generating) && (
              <div className="bg-surface border border-border p-6 mb-4">
                <div className="font-mono text-[10px] tracking-widest text-army-gold uppercase mb-3">
                  {PLAN_LABELS[form.plan_type]?.label} Development Plan
                </div>
                <div className="font-mono text-sm text-army-text whitespace-pre-wrap leading-relaxed">
                  {output.split('\n').map((line, i) => {
                    if (line.startsWith('## '))
                      return <div key={i} className="text-army-gold font-bold text-base mt-5 mb-2 first:mt-0">{line.replace('## ', '')}</div>;
                    if (line.startsWith('**') && line.endsWith('**'))
                      return <div key={i} className="text-army-text font-bold mt-3">{line.replace(/\*\*/g, '')}</div>;
                    return <div key={i}>{line}</div>;
                  })}
                  {generating && <span className="inline-block w-2 h-4 bg-army-gold ml-0.5 animate-pulse align-text-bottom" />}
                </div>
              </div>
            )}

            {!generating && output && (
              <button onClick={handleSave} disabled={saving}
                className="bg-army-tan hover:bg-[#9e8562] disabled:opacity-50 text-army-text font-mono text-xs tracking-widest uppercase px-6 py-2.5 transition-colors">
                {saving ? 'SAVING...' : 'SAVE PLAN'}
              </button>
            )}
          </div>
        )}

        {!selected && !showNew && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="font-mono text-4xl text-army-muted mb-3">◈</div>
              <div className="font-mono text-sm text-army-muted">Select a plan or create a new one from a DA 4856</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
