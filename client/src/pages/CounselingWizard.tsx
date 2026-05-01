import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { generateCounseling } from '../lib/api';
import { exportToPDF } from '../lib/exportPDF';

interface Soldier {
  id: string;
  first_name: string;
  last_name: string;
  rank: string;
}

const TYPES = ['Initial', 'Performance', 'Event-Oriented', 'Developmental'] as const;
type CounselingType = typeof TYPES[number];

const TYPE_DESCRIPTIONS: Record<CounselingType, string> = {
  Initial:         'Establishes expectations, duties, and standards at the start of a new assignment.',
  Performance:     'Addresses specific performance issues or recognizes outstanding performance.',
  'Event-Oriented': 'Documents a specific event — positive or negative — that warrants counseling.',
  Developmental:   'Focuses on long-term growth, career development, and strength-building.',
};

export default function CounselingWizard() {
  const [step, setStep] = useState(1);
  const [soldiers, setSoldiers] = useState<Soldier[]>([]);
  const [soldierId, setSoldierId] = useState('');
  const [type, setType] = useState<CounselingType>('Performance');
  const [observations, setObservations] = useState('');
  const [planOfAction, setPlanOfAction] = useState('');
  const [followup, setFollowup] = useState('');
  const [output, setOutput] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [userId, setUserId] = useState('');

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data } = await supabase
        .from('soldiers')
        .select('id, first_name, last_name, rank')
        .eq('nco_id', user.id)
        .order('last_name');
      if (data) setSoldiers(data);
    };
    init();
  }, []);

  const selectedSoldier = soldiers.find(s => s.id === soldierId);

  const handleGenerate = async () => {
    if (!selectedSoldier) return;
    setStep(4);
    setGenerating(true);
    setOutput('');
    setError('');

    try {
      await generateCounseling(
        {
          soldier: {
            name: `${selectedSoldier.first_name} ${selectedSoldier.last_name}`,
            rank: selectedSoldier.rank,
          },
          type,
          observations,
          plan_of_action: planOfAction,
          followup,
          nco_id: userId,
          soldier_id: soldierId,
        },
        chunk => setOutput(prev => prev + chunk)
      );
    } catch {
      setError('Failed to generate counseling. Verify your API key and server are running.');
    } finally {
      setGenerating(false);
    }
  };

  const reset = () => {
    setStep(1);
    setSoldierId('');
    setType('Performance');
    setObservations('');
    setPlanOfAction('');
    setFollowup('');
    setOutput('');
    setError('');
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">DA FORM 4856</div>
        <h1 className="text-xl font-bold text-army-text">Counseling Wizard</h1>
      </div>

      {/* Step Indicators */}
      {step < 4 && (
        <div className="flex gap-2 mb-8">
          {[1, 2, 3].map(n => (
            <div
              key={n}
              className={`flex-1 h-1 ${n <= step ? 'bg-army-gold' : 'bg-border'}`}
            />
          ))}
        </div>
      )}

      {/* ── Step 1: Select Soldier ── */}
      {step === 1 && (
        <div className="space-y-5">
          <div className="font-mono text-army-gold text-sm tracking-wider uppercase">Step 1 — Select Soldier</div>

          {soldiers.length === 0 ? (
            <div className="border border-border p-6 text-center font-mono text-army-muted text-sm">
              No soldiers on roster. Add a soldier first.
            </div>
          ) : (
            <div className="space-y-2">
              {soldiers.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSoldierId(s.id)}
                  className={`w-full text-left px-4 py-3 font-mono text-sm border transition-colors ${
                    soldierId === s.id
                      ? 'bg-army-tan border-army-tan text-army-text'
                      : 'bg-surface border-border text-army-text hover:border-army-tan'
                  }`}
                >
                  {s.rank} {s.last_name}, {s.first_name}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => setStep(2)}
            disabled={!soldierId}
            className="bg-army-tan hover:bg-[#9e8562] disabled:opacity-40 disabled:cursor-not-allowed text-army-text font-mono text-xs tracking-widest uppercase px-6 py-3 transition-colors"
          >
            NEXT →
          </button>
        </div>
      )}

      {/* ── Step 2: Counseling Type ── */}
      {step === 2 && (
        <div className="space-y-5">
          <div className="font-mono text-army-gold text-sm tracking-wider uppercase">Step 2 — Counseling Type</div>

          <div className="space-y-2">
            {TYPES.map(t => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`w-full text-left px-4 py-3 border transition-colors ${
                  type === t
                    ? 'bg-army-tan border-army-tan text-army-text'
                    : 'bg-surface border-border text-army-text hover:border-army-tan'
                }`}
              >
                <div className="font-mono text-sm font-bold">{t}</div>
                <div className="font-mono text-xs text-army-muted mt-0.5">{TYPE_DESCRIPTIONS[t]}</div>
              </button>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="border border-border text-army-muted hover:text-army-text font-mono text-xs tracking-widest uppercase px-5 py-2.5 transition-colors"
            >
              ← BACK
            </button>
            <button
              onClick={() => setStep(3)}
              className="bg-army-tan hover:bg-[#9e8562] text-army-text font-mono text-xs tracking-widest uppercase px-6 py-2.5 transition-colors"
            >
              NEXT →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Questions ── */}
      {step === 3 && (
        <div className="space-y-5">
          <div className="font-mono text-army-gold text-sm tracking-wider uppercase">
            Step 3 — {type} Counseling Details
          </div>

          <div>
            <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1.5">
              Key Observations <span className="text-danger">*</span>
            </label>
            <div className="font-mono text-xs text-army-muted mb-2">
              Factual, specific observations about the soldier's behavior or performance. Avoid opinion.
            </div>
            <textarea
              value={observations}
              onChange={e => setObservations(e.target.value)}
              rows={4}
              className="w-full bg-surface border border-border px-3 py-2.5 font-mono text-sm text-army-text placeholder-army-muted focus:outline-none focus:border-army-tan resize-none"
              placeholder="On [date], SPC Smith failed to report to formation at 0600 as required by unit SOP..."
            />
          </div>

          <div>
            <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1.5">
              Plan of Action <span className="text-danger">*</span>
            </label>
            <div className="font-mono text-xs text-army-muted mb-2">
              Specific, measurable actions the soldier will take. Include timelines.
            </div>
            <textarea
              value={planOfAction}
              onChange={e => setPlanOfAction(e.target.value)}
              rows={4}
              className="w-full bg-surface border border-border px-3 py-2.5 font-mono text-sm text-army-text placeholder-army-muted focus:outline-none focus:border-army-tan resize-none"
              placeholder="SPC Smith will set two alarms and report to formation 10 minutes early for the next 30 days..."
            />
          </div>

          <div>
            <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1.5">
              Follow-Up Requirements
            </label>
            <textarea
              value={followup}
              onChange={e => setFollowup(e.target.value)}
              rows={2}
              className="w-full bg-surface border border-border px-3 py-2.5 font-mono text-sm text-army-text placeholder-army-muted focus:outline-none focus:border-army-tan resize-none"
              placeholder="Follow-up counseling NLT 30 days from today..."
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(2)}
              className="border border-border text-army-muted hover:text-army-text font-mono text-xs tracking-widest uppercase px-5 py-2.5 transition-colors"
            >
              ← BACK
            </button>
            <button
              onClick={handleGenerate}
              disabled={!observations.trim() || !planOfAction.trim()}
              className="bg-army-tan hover:bg-[#9e8562] disabled:opacity-40 disabled:cursor-not-allowed text-army-text font-mono text-xs tracking-widest uppercase px-6 py-2.5 transition-colors"
            >
              GENERATE COUNSELING →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 4: Generated Output ── */}
      {step === 4 && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="font-mono text-army-gold text-sm tracking-wider uppercase">
              DA Form 4856 — {type} Counseling
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

          {selectedSoldier && (
            <div className="bg-surface border border-border px-4 py-2 flex gap-6">
              <div>
                <span className="font-mono text-[10px] text-army-muted uppercase">Soldier: </span>
                <span className="font-mono text-xs text-army-text">
                  {selectedSoldier.rank} {selectedSoldier.last_name}, {selectedSoldier.first_name}
                </span>
              </div>
              <div>
                <span className="font-mono text-[10px] text-army-muted uppercase">Type: </span>
                <span className="font-mono text-xs text-army-text">{type}</span>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-[#1f0e0d] border border-danger px-4 py-3 font-mono text-xs text-danger">
              {error}
            </div>
          )}

          <div className="bg-surface border border-border p-5 min-h-[300px]">
            {generating && !output && (
              <div className="font-mono text-army-muted text-sm animate-pulse">
                Generating counseling statement...
              </div>
            )}
            <pre className="font-mono text-sm text-army-text whitespace-pre-wrap leading-relaxed">
              {output}
              {generating && output && (
                <span className="inline-block w-2 h-4 bg-army-gold ml-0.5 animate-pulse align-text-bottom" />
              )}
            </pre>
          </div>

          {!generating && output && (
            <div className="flex gap-3">
              <button
                onClick={() => exportToPDF({
                  type: 'counseling',
                  soldier: { name: `${selectedSoldier?.first_name} ${selectedSoldier?.last_name}`, rank: selectedSoldier?.rank ?? '' },
                  subtitle: `${counselingType} Counseling`,
                  content: output,
                })}
                className="bg-army-tan hover:bg-[#9e8562] text-army-text font-mono text-xs tracking-widest uppercase px-5 py-2.5 transition-colors"
              >
                ↓ DOWNLOAD PDF
              </button>
              <button
                onClick={() => {
                  const blob = new Blob([output], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `counseling-${selectedSoldier?.last_name ?? 'soldier'}-${new Date().toISOString().split('T')[0]}.txt`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="border border-border text-army-muted hover:text-army-text font-mono text-xs tracking-widest uppercase px-5 py-2.5 transition-colors"
              >
                ↓ .TXT
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
