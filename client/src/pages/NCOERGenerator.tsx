import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { generateNCOER } from '../lib/api';

interface Soldier {
  id: string;
  first_name: string;
  last_name: string;
  rank: string;
  mos: string | null;
}

const ALL_SECTIONS = [
  'Character (Army Values / LDRSHIP)',
  'Presence (Military Bearing, Fitness, Confidence, Resilience)',
  'Intellect (Judgment, Innovation, Expertise)',
  'Leads (Leads Others, Builds Trust, Communicates)',
  'Develops (Develops Others, Creates Positive Environment)',
  'Achieves (Gets Results)',
  'Senior Rater Narrative (Potential)',
];

const RANKS = ['PVT','PV2','PFC','SPC','CPL','SGT','SSG','SFC','MSG','1SG','SGM','CSM'];

export default function NCOERGenerator() {
  const [soldiers, setSoldiers] = useState<Soldier[]>([]);
  const [soldierId, setSoldierId] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualRank, setManualRank] = useState('SGT');
  const [useManual, setUseManual] = useState(false);
  const [position, setPosition] = useState('');
  const [unit, setUnit] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [accomplishments, setAccomplishments] = useState('');
  const [sections, setSections] = useState<string[]>(ALL_SECTIONS);
  const [output, setOutput] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('soldiers')
        .select('id, first_name, last_name, rank, mos')
        .eq('nco_id', user.id)
        .order('last_name');
      if (data) setSoldiers(data);
    };
    load();
  }, []);

  const selectedSoldier = soldiers.find(s => s.id === soldierId);

  const soldierPayload = useManual
    ? { name: manualName, rank: manualRank }
    : selectedSoldier
      ? { name: `${selectedSoldier.first_name} ${selectedSoldier.last_name}`, rank: selectedSoldier.rank }
      : null;

  const toggleSection = (s: string) => {
    setSections(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
  };

  const handleGenerate = async () => {
    if (!soldierPayload || !accomplishments.trim()) return;
    setStep(3);
    setGenerating(true);
    setOutput('');
    setError('');

    try {
      await generateNCOER(
        {
          soldier: soldierPayload,
          position,
          unit,
          ratingPeriod: { from: fromDate, to: toDate },
          accomplishments,
          sections,
        },
        chunk => setOutput(prev => prev + chunk)
      );
    } catch {
      setError('Generation failed. Check your API connection.');
    } finally {
      setGenerating(false);
    }
  };

  const reset = () => {
    setStep(1);
    setSoldierId('');
    setManualName('');
    setPosition('');
    setUnit('');
    setFromDate('');
    setToDate('');
    setAccomplishments('');
    setSections(ALL_SECTIONS);
    setOutput('');
    setError('');
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <div className="font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">DA FORM 2166-9</div>
        <h1 className="text-xl font-bold text-army-text">NCOER Bullet Generator</h1>
      </div>

      {/* Step indicators */}
      {step < 3 && (
        <div className="flex gap-2 mb-8">
          {[1, 2].map(n => (
            <div key={n} className={`flex-1 h-1 ${n <= step ? 'bg-army-gold' : 'bg-border'}`} />
          ))}
        </div>
      )}

      {/* ── Step 1: Soldier + Details ── */}
      {step === 1 && (
        <div className="space-y-5">
          <div className="font-mono text-army-gold text-sm tracking-wider uppercase">
            Step 1 — Soldier & Rating Period
          </div>

          {/* Soldier selector */}
          <div>
            <div className="flex items-center gap-4 mb-3">
              <button
                onClick={() => setUseManual(false)}
                className={`font-mono text-xs tracking-wider px-3 py-1.5 transition-colors ${
                  !useManual ? 'bg-army-tan text-army-text' : 'border border-border text-army-muted hover:text-army-text'
                }`}
              >
                FROM ROSTER
              </button>
              <button
                onClick={() => setUseManual(true)}
                className={`font-mono text-xs tracking-wider px-3 py-1.5 transition-colors ${
                  useManual ? 'bg-army-tan text-army-text' : 'border border-border text-army-muted hover:text-army-text'
                }`}
              >
                ENTER MANUALLY
              </button>
            </div>

            {!useManual ? (
              soldiers.length === 0 ? (
                <div className="border border-border p-4 font-mono text-xs text-army-muted">
                  No soldiers on roster. Use "Enter Manually" or add soldiers first.
                </div>
              ) : (
                <select
                  value={soldierId}
                  onChange={e => setSoldierId(e.target.value)}
                  className="w-full bg-surface border border-border px-3 py-2.5 font-mono text-sm text-army-text focus:outline-none focus:border-army-tan"
                >
                  <option value="">-- Select soldier --</option>
                  {soldiers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.rank} {s.last_name}, {s.first_name}
                    </option>
                  ))}
                </select>
              )
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Rank</label>
                  <select
                    value={manualRank}
                    onChange={e => setManualRank(e.target.value)}
                    className="w-full bg-surface border border-border px-3 py-2 font-mono text-sm text-army-text focus:outline-none focus:border-army-tan"
                  >
                    {RANKS.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Full Name</label>
                  <input
                    value={manualName}
                    onChange={e => setManualName(e.target.value)}
                    placeholder="Last, First"
                    className="w-full bg-surface border border-border px-3 py-2 font-mono text-sm text-army-text placeholder-army-muted focus:outline-none focus:border-army-tan"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Duty Position</label>
              <input
                value={position}
                onChange={e => setPosition(e.target.value)}
                placeholder="e.g. Team Leader, Squad Leader"
                className="w-full bg-surface border border-border px-3 py-2 font-mono text-sm text-army-text placeholder-army-muted focus:outline-none focus:border-army-tan"
              />
            </div>
            <div>
              <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Unit</label>
              <input
                value={unit}
                onChange={e => setUnit(e.target.value)}
                placeholder="e.g. 1-8 CAV, 1CD"
                className="w-full bg-surface border border-border px-3 py-2 font-mono text-sm text-army-text placeholder-army-muted focus:outline-none focus:border-army-tan"
              />
            </div>
            <div>
              <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Rating Period From</label>
              <input
                type="date"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                className="w-full bg-surface border border-border px-3 py-2 font-mono text-sm text-army-text focus:outline-none focus:border-army-tan"
              />
            </div>
            <div>
              <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Rating Period To</label>
              <input
                type="date"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                className="w-full bg-surface border border-border px-3 py-2 font-mono text-sm text-army-text focus:outline-none focus:border-army-tan"
              />
            </div>
          </div>

          <button
            onClick={() => setStep(2)}
            disabled={!soldierPayload?.name}
            className="bg-army-tan hover:bg-[#9e8562] disabled:opacity-40 disabled:cursor-not-allowed text-army-text font-mono text-xs tracking-widest uppercase px-6 py-3 transition-colors"
          >
            NEXT →
          </button>
        </div>
      )}

      {/* ── Step 2: Accomplishments + Sections ── */}
      {step === 2 && (
        <div className="space-y-5">
          <div className="font-mono text-army-gold text-sm tracking-wider uppercase">
            Step 2 — Accomplishments & Sections
          </div>

          <div>
            <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1.5">
              Accomplishments / Notes <span className="text-danger">*</span>
            </label>
            <div className="font-mono text-xs text-army-muted mb-2">
              Paste in raw notes, previous bullets, counseling points, or a brain dump. The more specific the better — include numbers, unit sizes, dollar values, dates.
            </div>
            <textarea
              value={accomplishments}
              onChange={e => setAccomplishments(e.target.value)}
              rows={8}
              className="w-full bg-surface border border-border px-3 py-2.5 font-mono text-sm text-army-text placeholder-army-muted focus:outline-none focus:border-army-tan resize-none"
              placeholder={`Examples:
- Trained 23 Soldiers on crew-served weapons; unit achieved 94% qualification rate
- Maintained $1.2M in equipment with zero loss or damage for 18 months
- Selected as NCO of the Quarter out of 47 competitors
- Deployed to NTC rotation, led 14 combat patrols without incident
- Mentored 3 junior NCOs, all promoted ahead of peers`}
            />
          </div>

          {/* Section toggles */}
          <div>
            <div className="font-mono text-[10px] tracking-widest text-army-muted uppercase mb-2">
              Generate bullets for: ({sections.length} selected)
            </div>
            <div className="space-y-1.5">
              {ALL_SECTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => toggleSection(s)}
                  className={`w-full text-left px-3 py-2 font-mono text-xs transition-colors flex items-center gap-2 ${
                    sections.includes(s)
                      ? 'bg-army-tan text-army-text'
                      : 'bg-surface border border-border text-army-muted hover:text-army-text'
                  }`}
                >
                  <span>{sections.includes(s) ? '■' : '□'}</span>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="border border-border text-army-muted hover:text-army-text font-mono text-xs tracking-widest uppercase px-5 py-2.5 transition-colors"
            >
              ← BACK
            </button>
            <button
              onClick={handleGenerate}
              disabled={!accomplishments.trim() || sections.length === 0}
              className="bg-army-tan hover:bg-[#9e8562] disabled:opacity-40 disabled:cursor-not-allowed text-army-text font-mono text-xs tracking-widest uppercase px-6 py-2.5 transition-colors"
            >
              GENERATE BULLETS →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Output ── */}
      {step === 3 && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-mono text-army-gold text-sm tracking-wider uppercase">NCOER Bullets</div>
              {soldierPayload && (
                <div className="font-mono text-xs text-army-muted mt-0.5">
                  {soldierPayload.rank} {soldierPayload.name}
                  {position && ` · ${position}`}
                </div>
              )}
            </div>
            {!generating && output && (
              <button
                onClick={reset}
                className="border border-border text-army-muted hover:text-army-text font-mono text-xs tracking-widest uppercase px-4 py-1.5 transition-colors"
              >
                NEW
              </button>
            )}
          </div>

          {error && (
            <div className="bg-[#1f0e0d] border border-danger px-4 py-3 font-mono text-xs text-danger">{error}</div>
          )}

          <div className="bg-surface border border-border p-5 min-h-[400px]">
            {generating && !output && (
              <div className="font-mono text-army-muted text-sm animate-pulse">Generating NCOER bullets...</div>
            )}
            {/* Render section headers in gold, bullets in normal text */}
            <div className="font-mono text-sm text-army-text whitespace-pre-wrap leading-relaxed">
              {output.split('\n').map((line, i) => {
                if (line.startsWith('## ')) {
                  return (
                    <div key={i} className="text-army-gold font-bold mt-4 mb-1 first:mt-0">
                      {line.replace('## ', '')}
                    </div>
                  );
                }
                if (line.startsWith('• ')) {
                  return <div key={i} className="pl-2 text-army-text">{line}</div>;
                }
                return <div key={i}>{line}</div>;
              })}
              {generating && (
                <span className="inline-block w-2 h-4 bg-army-gold ml-0.5 animate-pulse align-text-bottom" />
              )}
            </div>
          </div>

          {!generating && output && (
            <button
              onClick={() => {
                const blob = new Blob([output], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `ncoer-${soldierPayload?.name?.replace(/\s/g, '-') ?? 'bullets'}-${new Date().toISOString().split('T')[0]}.txt`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="border border-army-gold text-army-gold hover:bg-army-gold hover:text-bg font-mono text-xs tracking-widest uppercase px-5 py-2.5 transition-colors"
            >
              ↓ DOWNLOAD .TXT
            </button>
          )}
        </div>
      )}
    </div>
  );
}
