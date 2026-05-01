import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { analyzeUnitGaps } from '../lib/api';
import { calcScore, type PromotionData } from '../lib/promotionScore';
import { exportToPDF } from '../lib/exportPDF';
import type { UnitSummary } from '../../api/training/gaps';

interface Soldier { id: string; rank: string; first_name: string; last_name: string }

function Bar({ label, value, max, color = 'bg-army-gold' }: { label: string; value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="mb-2">
      <div className="flex justify-between font-mono text-[10px] text-army-muted mb-1">
        <span>{label}</span>
        <span>{value} ({pct}%)</span>
      </div>
      <div className="h-2 bg-border">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function StatBox({ label, value, sub, danger }: { label: string; value: string | number; sub?: string; danger?: boolean }) {
  return (
    <div className="bg-surface border border-border p-4">
      <div className="font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">{label}</div>
      <div className={`font-mono text-2xl font-bold ${danger ? 'text-danger' : 'text-army-gold'}`}>{value}</div>
      {sub && <div className="font-mono text-[10px] text-army-muted mt-0.5">{sub}</div>}
    </div>
  );
}

export default function UnitGapAnalysis() {
  const [summary, setSummary]   = useState<UnitSummary | null>(null);
  const [soldiers, setSoldiers] = useState<Soldier[]>([]);
  const [analysis, setAnalysis] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [solRes, promoRes, counselRes, taskRes] = await Promise.all([
        supabase.from('soldiers').select('id, rank, first_name, last_name').eq('nco_id', user.id),
        supabase.from('promotion_data').select('*').eq('nco_id', user.id),
        supabase.from('counselings').select('soldier_id, created_at').eq('nco_id', user.id).order('created_at', { ascending: false }),
        supabase.from('tasks').select('soldier_id, status, due_date').eq('nco_id', user.id),
      ]);

      const soldiersData = solRes.data ?? [];
      setSoldiers(soldiersData);

      const promoMap: Record<string, PromotionData> = {};
      (promoRes.data ?? []).forEach((p: PromotionData) => {
        promoMap[p.soldier_id] = { ...p, custom_points: p.custom_points ?? [] };
      });

      // Latest counseling per soldier
      const lastCounseled: Record<string, string> = {};
      (counselRes.data ?? []).forEach(c => {
        if (!lastCounseled[c.soldier_id]) lastCounseled[c.soldier_id] = c.created_at;
      });

      const now = Date.now();
      const months3 = 90 * 86400000;
      const months6 = 180 * 86400000;

      const counselingStatus = { current: 0, overdueMonths3: 0, overdueMonths6: 0, never: 0 };
      soldiersData.forEach(s => {
        const last = lastCounseled[s.id];
        if (!last) { counselingStatus.never++; return; }
        const age = now - new Date(last).getTime();
        if (age < months3) counselingStatus.current++;
        else if (age < months6) counselingStatus.overdueMonths3++;
        else counselingStatus.overdueMonths6++;
      });

      const assessed = Object.keys(promoMap).length;
      const promo = { green: 0, amber: 0, red: 0 };
      const edu   = { wlcComplete: 0, alcComplete: 0, slcComplete: 0 };
      const acft  = { below540: 0, s540to580: 0, above580: 0, noData: 0 };
      const weap  = { expert: 0, sharpshooter: 0, marksman: 0, unqualified: 0, na: 0 };

      Object.values(promoMap).forEach(p => {
        const score = calcScore(p);
        if (score.status === 'GREEN') promo.green++;
        else if (score.status === 'AMBER') promo.amber++;
        else promo.red++;

        if (p.wlc_complete) edu.wlcComplete++;
        if (p.alc_complete) edu.alcComplete++;
        if (p.slc_complete) edu.slcComplete++;

        if (p.acft_score === 0) acft.noData++;
        else if (p.acft_score < 540) acft.below540++;
        else if (p.acft_score < 580) acft.s540to580++;
        else acft.above580++;

        const wq = p.weapons_qual;
        if (wq === 'Expert') weap.expert++;
        else if (wq === 'Sharpshooter') weap.sharpshooter++;
        else if (wq === 'Marksman') weap.marksman++;
        else if (wq === 'N/A') weap.na++;
        else weap.unqualified++;
      });

      const tasksData = taskRes.data ?? [];
      const todayStr  = new Date().toISOString().split('T')[0];
      const openTasks    = tasksData.filter(t => t.status !== 'complete').length;
      const overdueTasks = tasksData.filter(t => t.status !== 'complete' && t.due_date && t.due_date < todayStr).length;

      // Auto-identify top gaps
      const total = soldiersData.length;
      const topGaps: string[] = [];
      if (assessed < total) topGaps.push(`${total - assessed} of ${total} soldiers have no promotion assessment`);
      const wlcMissing = assessed - edu.wlcComplete;
      if (wlcMissing > 0) topGaps.push(`${wlcMissing} assessed soldier(s) missing WLC`);
      const alcMissing = assessed - edu.alcComplete;
      if (alcMissing > 0 && alcMissing < assessed) topGaps.push(`${alcMissing} soldier(s) missing ALC`);
      if (acft.below540 > 0) topGaps.push(`${acft.below540} soldier(s) scoring below 540 on ACFT`);
      if (weap.unqualified > 0) topGaps.push(`${weap.unqualified} soldier(s) unqualified on weapons`);
      if (counselingStatus.never > 0) topGaps.push(`${counselingStatus.never} soldier(s) never counseled`);
      if (counselingStatus.overdueMonths6 > 0) topGaps.push(`${counselingStatus.overdueMonths6} soldier(s) overdue counseling 6+ months`);
      if (overdueTasks > 0) topGaps.push(`${overdueTasks} overdue task(s) across the roster`);

      setSummary({
        totalSoldiers: total, assessed,
        promotionReadiness: promo,
        education: edu,
        acft, weapons: weap,
        counselingStatus,
        openTasks, overdueTasks,
        topGaps,
      });
      setLoading(false);
    };
    load();
  }, []);

  const handleAnalyze = async () => {
    if (!summary) return;
    setAnalyzing(true);
    setAnalysis('');
    try {
      await analyzeUnitGaps({ unitSummary: summary }, chunk => setAnalysis(p => p + chunk));
    } catch {
      setAnalysis('Analysis failed. Check server connection.');
    } finally {
      setAnalyzing(false);
    }
  };

  const total = summary?.totalSoldiers ?? 0;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <div className="font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Step 2 — Mentorship System</div>
        <h1 className="text-xl font-bold text-army-text">Unit Training Gap Analysis</h1>
        <div className="font-mono text-xs text-army-muted mt-1">
          {loading ? 'Loading...' : `${total} soldier${total !== 1 ? 's' : ''} on roster`}
        </div>
      </div>

      {!loading && summary && (
        <>
          {/* Top stat row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <StatBox label="Soldiers" value={total} sub="On roster" />
            <StatBox label="Assessed" value={summary.assessed} sub={`${total - summary.assessed} not assessed`} />
            <StatBox label="Promotion GREEN" value={summary.promotionReadiness.green} sub={`${summary.promotionReadiness.red} RED`} />
            <StatBox label="Overdue Tasks" value={summary.overdueTasks} sub={`${summary.openTasks} total open`} danger={summary.overdueTasks > 0} />
          </div>

          {/* Gap cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">

            {/* Promotion Readiness */}
            <div className="bg-surface border border-border p-5">
              <div className="font-mono text-[10px] tracking-widest text-army-muted uppercase mb-3">Promotion Readiness</div>
              <Bar label="GREEN — competitive" value={summary.promotionReadiness.green} max={summary.assessed || 1} color="bg-green-600" />
              <Bar label="AMBER — needs work" value={summary.promotionReadiness.amber} max={summary.assessed || 1} color="bg-yellow-500" />
              <Bar label="RED — not eligible/low pts" value={summary.promotionReadiness.red} max={summary.assessed || 1} color="bg-danger" />
              {total - summary.assessed > 0 && (
                <div className="font-mono text-[10px] text-danger mt-2">
                  ⚠ {total - summary.assessed} soldier(s) not yet assessed
                </div>
              )}
            </div>

            {/* Military Education */}
            <div className="bg-surface border border-border p-5">
              <div className="font-mono text-[10px] tracking-widest text-army-muted uppercase mb-3">Military Education (of assessed)</div>
              <Bar label="WLC Complete" value={summary.education.wlcComplete} max={summary.assessed || 1} />
              <Bar label="ALC Complete" value={summary.education.alcComplete} max={summary.assessed || 1} />
              <Bar label="SLC Complete" value={summary.education.slcComplete} max={summary.assessed || 1} />
            </div>

            {/* ACFT */}
            <div className="bg-surface border border-border p-5">
              <div className="font-mono text-[10px] tracking-widest text-army-muted uppercase mb-3">ACFT Score Distribution</div>
              <Bar label="580+ (competitive)" value={summary.acft.above580} max={summary.assessed || 1} color="bg-green-600" />
              <Bar label="540–579 (passing)" value={summary.acft.s540to580} max={summary.assessed || 1} color="bg-yellow-500" />
              <Bar label="Below 540" value={summary.acft.below540} max={summary.assessed || 1} color="bg-danger" />
              <Bar label="No data" value={summary.acft.noData} max={summary.assessed || 1} color="bg-border" />
            </div>

            {/* Weapons */}
            <div className="bg-surface border border-border p-5">
              <div className="font-mono text-[10px] tracking-widest text-army-muted uppercase mb-3">Weapons Qualification</div>
              <Bar label="Expert" value={summary.weapons.expert} max={summary.assessed || 1} color="bg-green-600" />
              <Bar label="Sharpshooter" value={summary.weapons.sharpshooter} max={summary.assessed || 1} color="bg-yellow-500" />
              <Bar label="Marksman" value={summary.weapons.marksman} max={summary.assessed || 1} />
              <Bar label="Unqualified" value={summary.weapons.unqualified} max={summary.assessed || 1} color="bg-danger" />
            </div>

            {/* Counseling status */}
            <div className="bg-surface border border-border p-5">
              <div className="font-mono text-[10px] tracking-widest text-army-muted uppercase mb-3">Counseling Status</div>
              <Bar label="Current (within 90 days)" value={summary.counselingStatus.current} max={total || 1} color="bg-green-600" />
              <Bar label="Overdue 3–6 months" value={summary.counselingStatus.overdueMonths3} max={total || 1} color="bg-yellow-500" />
              <Bar label="Overdue 6+ months" value={summary.counselingStatus.overdueMonths6} max={total || 1} color="bg-danger" />
              <Bar label="Never counseled" value={summary.counselingStatus.never} max={total || 1} color="bg-danger" />
            </div>

            {/* Top gaps summary */}
            <div className="bg-surface border border-border p-5">
              <div className="font-mono text-[10px] tracking-widest text-army-muted uppercase mb-3">
                System-Identified Gaps ({summary.topGaps.length})
              </div>
              {summary.topGaps.length === 0 ? (
                <div className="font-mono text-xs text-green-400">No critical gaps identified.</div>
              ) : (
                <div className="space-y-1.5">
                  {summary.topGaps.map((g, i) => (
                    <div key={i} className="flex gap-2 font-mono text-xs text-army-text">
                      <span className="text-danger flex-shrink-0">•</span>
                      <span>{g}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* AI Analysis */}
          <div className="flex gap-3 mb-6">
            <button onClick={handleAnalyze} disabled={analyzing}
              className="bg-army-tan hover:bg-[#9e8562] disabled:opacity-50 text-army-text font-mono text-sm tracking-wider uppercase px-6 py-3 transition-colors">
              {analyzing ? 'ANALYZING...' : '★ GENERATE UNIT TRAINING PLAN'}
            </button>
            {analysis && !analyzing && (
              <button
                onClick={() => exportToPDF({
                  type: 'development-plan',
                  soldier: { name: 'Unit', rank: '' },
                  subtitle: 'Unit Training Gap Analysis',
                  content: analysis,
                  filename: `unit-gap-analysis-${new Date().toISOString().split('T')[0]}`,
                })}
                className="border border-border text-army-muted hover:text-army-text font-mono text-xs tracking-widest uppercase px-5 py-3 transition-colors">
                ↓ PDF
              </button>
            )}
          </div>

          {(analysis || analyzing) && (
            <div className="bg-surface border border-army-gold p-6">
              <div className="font-mono text-[10px] tracking-widest text-army-gold uppercase mb-4">
                CSM Training Recommendation Brief
              </div>
              <div className="font-mono text-sm text-army-text whitespace-pre-wrap leading-relaxed">
                {analysis.split('\n').map((line, i) => {
                  if (line.startsWith('## '))
                    return <div key={i} className="text-army-gold font-bold text-base mt-5 mb-2 first:mt-0">{line.replace('## ', '')}</div>;
                  if (line.startsWith('**') && line.endsWith('**'))
                    return <div key={i} className="font-bold mt-2 text-army-text">{line.replace(/\*\*/g, '')}</div>;
                  return <div key={i}>{line}</div>;
                })}
                {analyzing && <span className="inline-block w-2 h-4 bg-army-gold ml-0.5 animate-pulse align-text-bottom" />}
              </div>
            </div>
          )}
        </>
      )}

      {!loading && total === 0 && (
        <div className="border border-border p-12 text-center">
          <div className="font-mono text-army-muted text-sm">No soldiers on roster. Add soldiers to generate a gap analysis.</div>
        </div>
      )}
    </div>
  );
}
