import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { generateAwardRec } from '../lib/api';
import { exportToPDF } from '../lib/exportPDF';

interface Soldier { id: string; first_name: string; last_name: string; rank: string }

const AWARDS = [
  { key: 'AAM',   label: 'Army Achievement Medal (AAM)',         level: 'Company' },
  { key: 'ARCOM', label: 'Army Commendation Medal (ARCOM)',       level: 'Battalion' },
  { key: 'MSM',   label: 'Meritorious Service Medal (MSM)',       level: 'Brigade+' },
  { key: 'BSM',   label: 'Bronze Star Medal (BSM)',               level: 'Theater' },
  { key: 'LOM',   label: 'Legion of Merit (LOM)',                 level: 'General Officer' },
  { key: 'SM',    label: "Soldier's Medal (SM)",                   level: 'Heroism (non-combat)' },
];

const RANKS = ['PVT','PV2','PFC','SPC','CPL','SGT','SSG','SFC','MSG','1SG','SGM','CSM'];

export default function AwardWizard() {
  const [step, setStep]                 = useState(1);
  const [soldiers, setSoldiers]         = useState<Soldier[]>([]);
  const [soldierId, setSoldierId]       = useState('');
  const [useManual, setUseManual]       = useState(false);
  const [manualName, setManualName]     = useState('');
  const [manualRank, setManualRank]     = useState('SGT');
  const [award, setAward]               = useState('ARCOM');
  const [position, setPosition]         = useState('');
  const [unit, setUnit]                 = useState('');
  const [periodFrom, setPeriodFrom]     = useState('');
  const [periodTo, setPeriodTo]         = useState('');
  const [accomplishments, setAccomplishments] = useState('');
  const [submittedBy, setSubmittedBy]   = useState('');
  const [output, setOutput]             = useState('');
  const [generating, setGenerating]     = useState(false);
  const [error, setError]               = useState('');

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('soldiers')
        .select('id, first_name, last_name, rank').eq('nco_id', user.id).order('last_name');
      if (data) setSoldiers(data);

      // Pre-fill submitter from profile
      const { data: profile } = await supabase.from('profiles')
        .select('rank, first_name, last_name').eq('id', user.id).single();
      if (profile?.last_name) {
        setSubmittedBy(`${profile.rank ?? ''} ${profile.last_name}`.trim());
      }
    };
    init();
  }, []);

  const selectedSoldier = soldiers.find(s => s.id === soldierId);
  const soldierPayload = useManual
    ? { name: manualName, rank: manualRank }
    : selectedSoldier
      ? { name: `${selectedSoldier.first_name} ${selectedSoldier.last_name}`, rank: selectedSoldier.rank }
      : null;

  const selectedAward = AWARDS.find(a => a.key === award)!;

  const handleGenerate = async () => {
    if (!soldierPayload || !accomplishments.trim()) return;
    setStep(3);
    setGenerating(true);
    setOutput('');
    setError('');
    try {
      await generateAwardRec(
        { soldier: soldierPayload, award, position, unit, periodFrom, periodTo, accomplishments, submittedBy },
        chunk => setOutput(p => p + chunk)
      );
    } catch {
      setError('Generation failed. Check server connection.');
    } finally {
      setGenerating(false);
    }
  };

  const reset = () => {
    setStep(1); setSoldierId(''); setManualName(''); setPosition(''); setUnit('');
    setPeriodFrom(''); setPeriodTo(''); setAccomplishments(''); setOutput(''); setError('');
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <div className="font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">DA FORM 638</div>
        <h1 className="text-xl font-bold text-army-text">Award Recommendation</h1>
      </div>

      {step < 3 && (
        <div className="flex gap-2 mb-8">
          {[1, 2].map(n => (
            <div key={n} className={`flex-1 h-1 ${n <= step ? 'bg-army-gold' : 'bg-border'}`} />
          ))}
        </div>
      )}

      {/* ── Step 1: Soldier + Award ── */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="font-mono text-army-gold text-sm tracking-wider uppercase">Step 1 — Soldier & Award</div>

          {/* Soldier selector */}
          <div>
            <div className="flex gap-3 mb-3">
              {(['roster', 'manual'] as const).map(m => (
                <button key={m} onClick={() => setUseManual(m === 'manual')}
                  className={`font-mono text-xs tracking-wider px-3 py-1.5 transition-colors ${
                    (m === 'manual') === useManual
                      ? 'bg-army-tan text-army-text'
                      : 'border border-border text-army-muted hover:text-army-text'
                  }`}>
                  {m === 'roster' ? 'FROM ROSTER' : 'ENTER MANUALLY'}
                </button>
              ))}
            </div>

            {!useManual ? (
              <select value={soldierId} onChange={e => setSoldierId(e.target.value)}
                className="w-full bg-surface border border-border px-3 py-2.5 font-mono text-sm text-army-text focus:outline-none focus:border-army-tan">
                <option value="">-- Select soldier --</option>
                {soldiers.map(s => (
                  <option key={s.id} value={s.id}>{s.rank} {s.last_name}, {s.first_name}</option>
                ))}
              </select>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Rank</label>
                  <select value={manualRank} onChange={e => setManualRank(e.target.value)}
                    className="w-full bg-surface border border-border px-3 py-2 font-mono text-sm text-army-text focus:outline-none focus:border-army-tan">
                    {RANKS.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Full Name</label>
                  <input value={manualName} onChange={e => setManualName(e.target.value)} placeholder="Last, First"
                    className="w-full bg-surface border border-border px-3 py-2 font-mono text-sm text-army-text placeholder-army-muted focus:outline-none focus:border-army-tan" />
                </div>
              </div>
            )}
          </div>

          {/* Award selector */}
          <div>
            <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-2">Award</label>
            <div className="space-y-2">
              {AWARDS.map(a => (
                <button key={a.key} onClick={() => setAward(a.key)}
                  className={`w-full text-left px-4 py-3 border transition-colors ${
                    award === a.key ? 'bg-army-tan border-army-tan' : 'bg-surface border-border hover:border-army-tan'
                  }`}>
                  <div className="font-mono text-sm font-bold text-army-text">{a.label}</div>
                  <div className="font-mono text-[10px] text-army-muted mt-0.5">Approval level: {a.level}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Duty Position</label>
              <input value={position} onChange={e => setPosition(e.target.value)} placeholder="e.g. Squad Leader"
                className="w-full bg-surface border border-border px-3 py-2 font-mono text-sm text-army-text placeholder-army-muted focus:outline-none focus:border-army-tan" />
            </div>
            <div>
              <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Unit</label>
              <input value={unit} onChange={e => setUnit(e.target.value)} placeholder="e.g. HHC, 1-8 CAV"
                className="w-full bg-surface border border-border px-3 py-2 font-mono text-sm text-army-text placeholder-army-muted focus:outline-none focus:border-army-tan" />
            </div>
            <div>
              <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Period From</label>
              <input type="date" value={periodFrom} onChange={e => setPeriodFrom(e.target.value)}
                className="w-full bg-surface border border-border px-3 py-2 font-mono text-sm text-army-text focus:outline-none focus:border-army-tan" />
            </div>
            <div>
              <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Period To</label>
              <input type="date" value={periodTo} onChange={e => setPeriodTo(e.target.value)}
                className="w-full bg-surface border border-border px-3 py-2 font-mono text-sm text-army-text focus:outline-none focus:border-army-tan" />
            </div>
            <div className="col-span-2">
              <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Submitted By</label>
              <input value={submittedBy} onChange={e => setSubmittedBy(e.target.value)} placeholder="Recommending NCO rank + name"
                className="w-full bg-surface border border-border px-3 py-2 font-mono text-sm text-army-text placeholder-army-muted focus:outline-none focus:border-army-tan" />
            </div>
          </div>

          <button onClick={() => setStep(2)} disabled={!soldierPayload?.name}
            className="bg-army-tan hover:bg-[#9e8562] disabled:opacity-40 disabled:cursor-not-allowed text-army-text font-mono text-xs tracking-widest uppercase px-6 py-3 transition-colors">
            NEXT →
          </button>
        </div>
      )}

      {/* ── Step 2: Accomplishments ── */}
      {step === 2 && (
        <div className="space-y-5">
          <div className="font-mono text-army-gold text-sm tracking-wider uppercase">
            Step 2 — Accomplishments
          </div>

          {soldierPayload && (
            <div className="bg-surface border border-border px-4 py-2 flex gap-6">
              <div>
                <span className="font-mono text-[10px] text-army-muted">SOLDIER: </span>
                <span className="font-mono text-xs text-army-text">{soldierPayload.rank} {soldierPayload.name}</span>
              </div>
              <div>
                <span className="font-mono text-[10px] text-army-muted">AWARD: </span>
                <span className="font-mono text-xs text-army-gold">{selectedAward.label}</span>
              </div>
            </div>
          )}

          <div>
            <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1.5">
              Accomplishments & Supporting Facts <span className="text-danger">*</span>
            </label>
            <div className="font-mono text-xs text-army-muted mb-2">
              Brain dump everything — events, dates, numbers, unit sizes, dollar amounts, mission names.
              The more specific the input, the stronger the award recommendation.
              Calibrate to the {selectedAward.key} level ({selectedAward.level} approval).
            </div>
            <textarea value={accomplishments} onChange={e => setAccomplishments(e.target.value)} rows={10}
              className="w-full bg-surface border border-border px-3 py-2.5 font-mono text-sm text-army-text placeholder-army-muted focus:outline-none focus:border-army-tan resize-none"
              placeholder={`Examples for ${selectedAward.key}:\n- Trained 23 Soldiers on crew-served weapons, achieving 96% qualification rate\n- Maintained accountability of $1.4M in equipment through 2 combat deployments\n- Mentored 4 junior NCOs, all promoted ahead of peers\n- Deployed to NTC Jan-Mar 2024, served as NCOIC of S3 cell\n- Implemented new SOP reducing vehicle maintenance delinquencies by 40%`} />
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(1)}
              className="border border-border text-army-muted hover:text-army-text font-mono text-xs tracking-widest uppercase px-5 py-2.5 transition-colors">
              ← BACK
            </button>
            <button onClick={handleGenerate} disabled={!accomplishments.trim()}
              className="bg-army-tan hover:bg-[#9e8562] disabled:opacity-40 disabled:cursor-not-allowed text-army-text font-mono text-xs tracking-widest uppercase px-6 py-2.5 transition-colors">
              GENERATE RECOMMENDATION →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Output ── */}
      {step === 3 && (
        <div className="space-y-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-mono text-army-gold text-sm tracking-wider uppercase">
                DA 638 — {selectedAward.label}
              </div>
              {soldierPayload && (
                <div className="font-mono text-xs text-army-muted mt-0.5">
                  {soldierPayload.rank} {soldierPayload.name}
                  {position ? ` · ${position}` : ''}
                  {unit ? ` · ${unit}` : ''}
                </div>
              )}
            </div>
            {!generating && output && (
              <button onClick={reset}
                className="border border-border text-army-muted hover:text-army-text font-mono text-xs tracking-widest uppercase px-4 py-1.5 transition-colors">
                NEW
              </button>
            )}
          </div>

          {error && (
            <div className="bg-[#1f0e0d] border border-danger px-4 py-3 font-mono text-xs text-danger">{error}</div>
          )}

          <div className="bg-surface border border-border p-6 min-h-[300px]">
            {generating && !output && (
              <div className="font-mono text-army-muted text-sm animate-pulse">Generating award recommendation...</div>
            )}
            <div className="font-mono text-sm text-army-text whitespace-pre-wrap leading-relaxed">
              {output.split('\n').map((line, i) => {
                if (line.startsWith('## '))
                  return <div key={i} className="text-army-gold font-bold text-base mt-5 mb-2 first:mt-0">{line.replace('## ', '')}</div>;
                if (line.startsWith('**') && line.endsWith('**'))
                  return <div key={i} className="font-bold mt-2">{line.replace(/\*\*/g, '')}</div>;
                return <div key={i}>{line}</div>;
              })}
              {generating && <span className="inline-block w-2 h-4 bg-army-gold ml-0.5 animate-pulse align-text-bottom" />}
            </div>
          </div>

          {!generating && output && soldierPayload && (
            <div className="flex gap-3">
              <button
                onClick={() => exportToPDF({
                  type: 'counseling',
                  soldier: soldierPayload,
                  subtitle: selectedAward.label,
                  content: output,
                  filename: `da638-${soldierPayload.name.replace(/[\s,]+/g, '-')}-${award}`,
                })}
                className="bg-army-tan hover:bg-[#9e8562] text-army-text font-mono text-xs tracking-widest uppercase px-5 py-2.5 transition-colors">
                ↓ DOWNLOAD PDF
              </button>
              <button
                onClick={() => {
                  const blob = new Blob([output], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `da638-${soldierPayload.name.replace(/[\s,]+/g, '-')}-${award}.txt`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="border border-border text-army-muted hover:text-army-text font-mono text-xs tracking-widest uppercase px-5 py-2.5 transition-colors">
                ↓ .TXT
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
