import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { generateTrainingPlan, generateLessonPlan } from '../lib/api';
import { exportToPDF } from '../lib/exportPDF';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TrainingEvent {
  id: string;
  title: string;
  event_type: string;
  component: string;
  start_date: string;
  end_date: string;
  location: string | null;
  unit: string | null;
  soldier_count: number;
  theme: string | null;
  mission_focus: string | null;
  opord: string | null;
  ai_schedule: string | null;
  status: string;
  created_at: string;
}

interface LessonPlan {
  id: string;
  event_id: string | null;
  title: string;
  duration_min: number;
  target_audience: string;
  content_outline: string | null;
  created_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EVENT_TYPES = [
  { key: 'drill_weekend',    label: 'Drill Weekend',          desc: 'Monthly Battle Assembly (~16 hrs)' },
  { key: 'annual_training',  label: 'Annual Training (AT)',   desc: '2-week culminating event (brigade+)' },
  { key: 'training_day',     label: 'Training Day',           desc: 'Single-day focused training' },
  { key: 'range_day',        label: 'Range / Qualification',  desc: 'Weapons qual or range event' },
  { key: 'custom',           label: 'Custom Event',           desc: 'Other training event' },
];

const COMPONENTS = [
  { key: 'guard_reserve', label: 'Guard / Reserve / State Guard' },
  { key: 'active',        label: 'Active Component' },
];

const STATUS_COLORS: Record<string, string> = {
  planning:  'text-yellow-400 border-yellow-700',
  approved:  'text-green-400 border-green-700',
  complete:  'text-army-muted border-border',
};

const BLANK_EVENT = {
  title: '', event_type: 'drill_weekend', component: 'guard_reserve',
  start_date: '', end_date: '', location: '', unit: '',
  soldier_count: 20, theme: '', mission_focus: '',
};

const LESSON_DURATIONS = [30, 45, 60, 90, 120];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dayCount(start: string, end: string) {
  if (!start || !end) return 0;
  return Math.max(1, Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1);
}

function eventTypeLabel(key: string) {
  return EVENT_TYPES.find(e => e.key === key)?.label ?? key;
}

function renderMarkdown(text: string) {
  return text.split('\n').map((line, i) => {
    if (line.startsWith('## '))
      return <div key={i} className="text-army-gold font-bold text-base mt-5 mb-2 first:mt-0 uppercase tracking-wide">{line.replace('## ', '')}</div>;
    if (line.startsWith('**') && line.endsWith('**'))
      return <div key={i} className="font-bold text-army-text mt-2">{line.replace(/\*\*/g, '')}</div>;
    if (line.startsWith('| ') && line.includes(' | '))
      return <div key={i} className="font-mono text-xs text-army-text border-b border-border py-1">{line.replace(/\|/g, '·')}</div>;
    if (line.trim() === '') return <div key={i} className="h-2" />;
    return <div key={i} className="font-mono text-sm text-army-text leading-relaxed">{line}</div>;
  });
}

// ─── Main Component ───────────────────────────────────────────────────────────

type DetailTab = 'overview' | 'schedule' | 'opord' | 'lessons';

export default function TrainingPlanner() {
  const [events, setEvents]         = useState<TrainingEvent[]>([]);
  const [lessons, setLessons]       = useState<LessonPlan[]>([]);
  const [selected, setSelected]     = useState<TrainingEvent | null>(null);
  const [tab, setTab]               = useState<DetailTab>('overview');
  const [showNew, setShowNew]       = useState(false);
  const [form, setForm]             = useState(BLANK_EVENT);
  const [saving, setSaving]         = useState(false);
  const [userId, setUserId]         = useState('');
  const [loading, setLoading]       = useState(true);

  // Streaming state
  const [opord, setOpord]           = useState('');
  const [schedule, setSchedule]     = useState('');
  const [genOpord, setGenOpord]     = useState(false);
  const [genSchedule, setGenSchedule] = useState(false);

  // Lesson plan state
  const [lpTopic, setLpTopic]       = useState('');
  const [lpDuration, setLpDuration] = useState(90);
  const [lpAudience, setLpAudience] = useState('All Soldiers');
  const [lpContext, setLpContext]   = useState('');
  const [lpOutput, setLpOutput]     = useState('');
  const [genLP, setGenLP]           = useState(false);
  const [savingLP, setSavingLP]     = useState(false);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const [evRes, lpRes] = await Promise.all([
      supabase.from('training_events').select('*').eq('nco_id', user.id).order('start_date', { ascending: false }),
      supabase.from('lesson_plans').select('id, event_id, title, duration_min, target_audience, content_outline, created_at').eq('nco_id', user.id).order('created_at', { ascending: false }),
    ]);

    if (evRes.data) setEvents(evRes.data);
    if (lpRes.data) setLessons(lpRes.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const selectEvent = (ev: TrainingEvent) => {
    setSelected(ev);
    setShowNew(false);
    setTab('overview');
    setOpord(ev.opord ?? '');
    setSchedule(ev.ai_schedule ?? '');
    setLpOutput('');
    setLpTopic('');
  };

  const saveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.start_date || !form.end_date) return;
    setSaving(true);

    const { data } = await supabase.from('training_events').insert({
      ...form,
      nco_id: userId,
      location: form.location || null,
      unit: form.unit || null,
      theme: form.theme || null,
      mission_focus: form.mission_focus || null,
    }).select().single();

    if (data) {
      setEvents(ev => [data, ...ev]);
      selectEvent(data);
      setShowNew(false);
      setForm(BLANK_EVENT);
    }
    setSaving(false);
  };

  const saveField = async (field: Partial<TrainingEvent>) => {
    if (!selected) return;
    await supabase.from('training_events').update({ ...field, updated_at: new Date().toISOString() }).eq('id', selected.id);
    setSelected(s => s ? { ...s, ...field } : s);
    setEvents(ev => ev.map(e => e.id === selected.id ? { ...e, ...field } : e));
  };

  const handleGenOpord = async () => {
    if (!selected) return;
    setGenOpord(true);
    setOpord('');
    setTab('opord');
    try {
      await generateTrainingPlan({ mode: 'opord', eventData: selected }, chunk => setOpord(p => p + chunk));
      await saveField({ opord: '' }); // will be updated after
    } catch { setOpord('Generation failed.'); }
    finally { setGenOpord(false); }
  };

  const handleGenSchedule = async () => {
    if (!selected) return;
    setGenSchedule(true);
    setSchedule('');
    setTab('schedule');
    try {
      await generateTrainingPlan({ mode: 'schedule', eventData: selected }, chunk => setSchedule(p => p + chunk));
    } catch { setSchedule('Generation failed.'); }
    finally { setGenSchedule(false); }
  };

  const handleSaveOpord = async () => {
    await saveField({ opord });
  };

  const handleSaveSchedule = async () => {
    await saveField({ ai_schedule: schedule });
  };

  const handleGenLesson = async () => {
    if (!lpTopic.trim() || !selected) return;
    setGenLP(true);
    setLpOutput('');
    try {
      await generateLessonPlan(
        { topic: lpTopic, duration: lpDuration, audience: lpAudience, component: selected.component, context: lpContext || selected.theme },
        chunk => setLpOutput(p => p + chunk)
      );
    } catch { setLpOutput('Generation failed.'); }
    finally { setGenLP(false); }
  };

  const handleSaveLesson = async () => {
    if (!lpOutput || !selected) return;
    setSavingLP(true);
    const { data } = await supabase.from('lesson_plans').insert({
      nco_id: userId,
      event_id: selected.id,
      title: lpTopic,
      duration_min: lpDuration,
      target_audience: lpAudience,
      content_outline: lpOutput,
    }).select('id, event_id, title, duration_min, target_audience, content_outline, created_at').single();
    if (data) {
      setLessons(ls => [data, ...ls]);
      setLpTopic('');
      setLpOutput('');
      setLpContext('');
    }
    setSavingLP(false);
  };

  const eventLessons = lessons.filter(l => l.event_id === selected?.id);

  const TABS: { key: DetailTab; label: string }[] = [
    { key: 'overview',  label: 'OVERVIEW' },
    { key: 'schedule',  label: 'SCHEDULE' },
    { key: 'opord',     label: 'OPORD' },
    { key: 'lessons',   label: `LESSON PLANS (${eventLessons.length})` },
  ];

  return (
    <div className="flex h-full">
      {/* ── Event list ── */}
      <div className="w-72 flex-shrink-0 border-r border-border flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <div className="font-mono text-[10px] tracking-widest text-army-muted uppercase">FM 7-0</div>
            <div className="font-mono text-sm font-bold text-army-text mt-0.5">Training Planner</div>
          </div>
          <button onClick={() => { setShowNew(true); setSelected(null); }}
            className="bg-army-tan hover:bg-[#9e8562] text-army-text font-mono text-[10px] tracking-widest uppercase px-3 py-1.5 transition-colors">
            + NEW
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {loading ? <div className="px-5 py-4 font-mono text-xs text-army-muted">Loading...</div>
            : events.length === 0 && !showNew ? (
              <div className="px-5 py-8 text-center font-mono text-xs text-army-muted">
                No training events yet.<br />Create your first event.
              </div>
            ) : events.map(ev => (
              <button key={ev.id} onClick={() => selectEvent(ev)}
                className={`w-full text-left px-5 py-3 border-b border-border transition-colors ${selected?.id === ev.id ? 'bg-army-tan' : 'hover:bg-[#21262d]'}`}>
                <div className="font-mono text-xs font-bold text-army-text leading-snug">{ev.title}</div>
                <div className="font-mono text-[10px] text-army-gold mt-0.5">{eventTypeLabel(ev.event_type)}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-mono text-[10px] text-army-muted">
                    {new Date(ev.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    {ev.start_date !== ev.end_date && ` – ${new Date(ev.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                  </span>
                  <span className={`font-mono text-[9px] border px-1 ${STATUS_COLORS[ev.status]}`}>{ev.status.toUpperCase()}</span>
                </div>
              </button>
            ))}
        </div>
      </div>

      {/* ── Detail / New form ── */}
      <div className="flex-1 overflow-y-auto">

        {/* New event form */}
        {showNew && (
          <div className="p-8 max-w-3xl">
            <div className="mb-6">
              <div className="font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">New Training Event</div>
              <div className="font-mono text-xl font-bold text-army-text">Plan Your Training</div>
            </div>

            <form onSubmit={saveEvent} className="space-y-5">
              <div>
                <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Event Title <span className="text-danger">*</span></label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required
                  placeholder="e.g. May 2026 Battle Assembly — Leader Development"
                  className="w-full bg-surface border border-border px-3 py-2.5 font-mono text-sm text-army-text placeholder-army-muted focus:outline-none focus:border-army-tan" />
              </div>

              {/* Component toggle */}
              <div>
                <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-2">Component</label>
                <div className="flex gap-2">
                  {COMPONENTS.map(c => (
                    <button key={c.key} type="button" onClick={() => setForm(f => ({ ...f, component: c.key }))}
                      className={`flex-1 py-2.5 font-mono text-xs tracking-wider transition-colors border ${
                        form.component === c.key ? 'bg-army-tan border-army-tan text-army-text' : 'border-border text-army-muted hover:text-army-text'
                      }`}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Event type */}
              <div>
                <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-2">Event Type</label>
                <div className="grid grid-cols-1 gap-1.5">
                  {EVENT_TYPES.map(et => (
                    <button key={et.key} type="button" onClick={() => setForm(f => ({ ...f, event_type: et.key }))}
                      className={`text-left px-4 py-2.5 border transition-colors ${
                        form.event_type === et.key ? 'bg-army-tan border-army-tan text-army-text' : 'bg-surface border-border text-army-text hover:border-army-tan'
                      }`}>
                      <span className="font-mono text-sm font-bold">{et.label}</span>
                      <span className="font-mono text-[10px] text-army-muted ml-2">{et.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Start Date <span className="text-danger">*</span></label>
                  <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} required
                    className="w-full bg-surface border border-border px-3 py-2 font-mono text-sm text-army-text focus:outline-none focus:border-army-tan" />
                </div>
                <div>
                  <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">End Date <span className="text-danger">*</span></label>
                  <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} required
                    className="w-full bg-surface border border-border px-3 py-2 font-mono text-sm text-army-text focus:outline-none focus:border-army-tan" />
                </div>
                <div>
                  <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Location</label>
                  <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                    placeholder="Armory / Training Area"
                    className="w-full bg-surface border border-border px-3 py-2 font-mono text-sm text-army-text placeholder-army-muted focus:outline-none focus:border-army-tan" />
                </div>
                <div>
                  <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Unit</label>
                  <input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                    placeholder="e.g. HHC, 1st Battalion"
                    className="w-full bg-surface border border-border px-3 py-2 font-mono text-sm text-army-text placeholder-army-muted focus:outline-none focus:border-army-tan" />
                </div>
                <div>
                  <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Soldier Count</label>
                  <input type="number" min={1} value={form.soldier_count} onChange={e => setForm(f => ({ ...f, soldier_count: +e.target.value }))}
                    className="w-full bg-surface border border-border px-3 py-2 font-mono text-sm text-army-text focus:outline-none focus:border-army-tan" />
                </div>
                <div>
                  <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Training Theme</label>
                  <input value={form.theme} onChange={e => setForm(f => ({ ...f, theme: e.target.value }))}
                    placeholder="e.g. Leader Development, Warrior Tasks"
                    className="w-full bg-surface border border-border px-3 py-2 font-mono text-sm text-army-text placeholder-army-muted focus:outline-none focus:border-army-tan" />
                </div>
              </div>

              <div>
                <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Mission Focus / Training Objectives</label>
                <textarea rows={3} value={form.mission_focus} onChange={e => setForm(f => ({ ...f, mission_focus: e.target.value }))}
                  placeholder="What do you need soldiers to be able to DO by the end of this event? What skills, tasks, or standards?"
                  className="w-full bg-surface border border-border px-3 py-2.5 font-mono text-sm text-army-text placeholder-army-muted focus:outline-none focus:border-army-tan resize-none" />
              </div>

              <div className="flex gap-3">
                <button type="submit" disabled={saving}
                  className="bg-army-tan hover:bg-[#9e8562] disabled:opacity-50 text-army-text font-mono text-xs tracking-widest uppercase px-6 py-2.5 transition-colors">
                  {saving ? 'SAVING...' : 'CREATE EVENT →'}
                </button>
                <button type="button" onClick={() => { setShowNew(false); setForm(BLANK_EVENT); }}
                  className="border border-border font-mono text-xs uppercase px-5 py-2.5 text-army-muted hover:text-army-text transition-colors">
                  CANCEL
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Event detail */}
        {selected && !showNew && (
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-8 py-5 border-b border-border bg-surface flex items-start justify-between">
              <div>
                <div className="font-mono text-army-gold text-lg font-bold">{selected.title}</div>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="font-mono text-xs text-army-text">{eventTypeLabel(selected.event_type)}</span>
                  <span className="font-mono text-[10px] text-army-muted">·</span>
                  <span className="font-mono text-xs text-army-muted">
                    {new Date(selected.start_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    {selected.start_date !== selected.end_date && ` – ${new Date(selected.end_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`}
                    {' '}({dayCount(selected.start_date, selected.end_date)} day{dayCount(selected.start_date, selected.end_date) > 1 ? 's' : ''})
                  </span>
                  {selected.location && <><span className="font-mono text-[10px] text-army-muted">·</span><span className="font-mono text-xs text-army-muted">{selected.location}</span></>}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={handleGenOpord} disabled={genOpord}
                  className="border border-border hover:border-army-tan text-army-muted hover:text-army-text font-mono text-[10px] tracking-wider uppercase px-3 py-1.5 transition-colors disabled:opacity-50">
                  {genOpord ? '...' : '⊞ OPORD'}
                </button>
                <button onClick={handleGenSchedule} disabled={genSchedule}
                  className="border border-border hover:border-army-tan text-army-muted hover:text-army-text font-mono text-[10px] tracking-wider uppercase px-3 py-1.5 transition-colors disabled:opacity-50">
                  {genSchedule ? '...' : '▣ SCHEDULE'}
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border px-8">
              {TABS.map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`px-4 py-2.5 font-mono text-xs tracking-wider transition-colors ${
                    tab === t.key ? 'border-b-2 border-army-gold text-army-gold' : 'text-army-muted hover:text-army-text'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto px-8 py-6">

              {/* ── Overview tab ── */}
              {tab === 'overview' && (
                <div className="max-w-3xl space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: 'Event Type',   value: eventTypeLabel(selected.event_type) },
                      { label: 'Component',    value: selected.component === 'guard_reserve' ? 'Guard / Reserve' : 'Active Component' },
                      { label: 'Soldiers',     value: String(selected.soldier_count) },
                      { label: 'Unit',         value: selected.unit || '—' },
                      { label: 'Theme',        value: selected.theme || '—' },
                      { label: 'Status',       value: selected.status.toUpperCase() },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-bg border border-border p-3">
                        <div className="font-mono text-[10px] tracking-widest text-army-muted uppercase mb-0.5">{label}</div>
                        <div className="font-mono text-sm text-army-text">{value}</div>
                      </div>
                    ))}
                  </div>

                  {selected.mission_focus && (
                    <div className="bg-bg border border-border p-4">
                      <div className="font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Mission Focus / Training Objectives</div>
                      <div className="font-mono text-sm text-army-text whitespace-pre-wrap">{selected.mission_focus}</div>
                    </div>
                  )}

                  <div className="bg-surface border border-army-tan p-5">
                    <div className="font-mono text-[10px] tracking-widest text-army-gold uppercase mb-3">AI Planning Tools</div>
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={handleGenOpord}
                        className="bg-surface border border-border hover:border-army-tan text-army-text font-mono text-xs tracking-wider uppercase px-4 py-3 transition-colors text-left">
                        <div className="text-army-gold mb-1">⊞</div>
                        Generate OPORD<br />
                        <span className="text-army-muted text-[10px]">5-paragraph operations order</span>
                      </button>
                      <button onClick={handleGenSchedule}
                        className="bg-surface border border-border hover:border-army-tan text-army-text font-mono text-xs tracking-wider uppercase px-4 py-3 transition-colors text-left">
                        <div className="text-army-gold mb-1">▣</div>
                        Generate Schedule<br />
                        <span className="text-army-muted text-[10px]">Time-blocked training schedule</span>
                      </button>
                      <button onClick={() => setTab('lessons')}
                        className="bg-surface border border-border hover:border-army-tan text-army-text font-mono text-xs tracking-wider uppercase px-4 py-3 transition-colors text-left">
                        <div className="text-army-gold mb-1">◈</div>
                        Lesson Plans<br />
                        <span className="text-army-muted text-[10px]">ALC-format lesson plans</span>
                      </button>
                      <div className="bg-bg border border-border px-4 py-3">
                        <div className="font-mono text-[10px] text-army-muted uppercase mb-1">Progress</div>
                        <div className="font-mono text-xs text-army-text">
                          {selected.opord ? '✓ OPORD' : '○ OPORD'}<br />
                          {selected.ai_schedule ? '✓ Schedule' : '○ Schedule'}<br />
                          {eventLessons.length > 0 ? `✓ ${eventLessons.length} lesson plan(s)` : '○ Lesson plans'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Status control */}
                  <div className="flex gap-2">
                    {(['planning', 'approved', 'complete'] as const).map(s => (
                      <button key={s} onClick={() => saveField({ status: s })}
                        className={`font-mono text-[10px] tracking-widest uppercase px-3 py-1.5 border transition-colors ${
                          selected.status === s ? 'bg-army-tan border-army-tan text-army-text' : 'border-border text-army-muted hover:text-army-text'
                        }`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Schedule tab ── */}
              {tab === 'schedule' && (
                <div className="max-w-4xl">
                  <div className="flex items-center gap-3 mb-5">
                    <button onClick={handleGenSchedule} disabled={genSchedule}
                      className="bg-army-tan hover:bg-[#9e8562] disabled:opacity-50 text-army-text font-mono text-xs tracking-widest uppercase px-5 py-2 transition-colors">
                      {genSchedule ? 'GENERATING...' : schedule ? '↺ REGENERATE' : '▣ GENERATE SCHEDULE'}
                    </button>
                    {schedule && !genSchedule && (
                      <>
                        <button onClick={handleSaveSchedule}
                          className="border border-border font-mono text-xs uppercase px-4 py-2 text-army-muted hover:text-army-text transition-colors">
                          SAVE
                        </button>
                        <button onClick={() => exportToPDF({
                          type: 'development-plan',
                          soldier: { name: selected.unit ?? 'Unit', rank: '' },
                          subtitle: `Training Schedule — ${eventTypeLabel(selected.event_type)}`,
                          content: schedule,
                          filename: `training-schedule-${selected.title.replace(/\s+/g, '-')}`,
                        })}
                          className="border border-border font-mono text-xs uppercase px-4 py-2 text-army-muted hover:text-army-text transition-colors">
                          ↓ PDF
                        </button>
                      </>
                    )}
                  </div>

                  {(schedule || genSchedule) ? (
                    <div className="bg-surface border border-border p-6">
                      <div className="space-y-1">{renderMarkdown(schedule)}</div>
                      {genSchedule && <span className="inline-block w-2 h-4 bg-army-gold ml-1 animate-pulse align-text-bottom" />}
                    </div>
                  ) : (
                    <div className="border border-border p-10 text-center font-mono text-army-muted text-sm">
                      Click "Generate Schedule" to build a time-blocked training schedule for this event.
                    </div>
                  )}
                </div>
              )}

              {/* ── OPORD tab ── */}
              {tab === 'opord' && (
                <div className="max-w-3xl">
                  <div className="flex items-center gap-3 mb-5">
                    <button onClick={handleGenOpord} disabled={genOpord}
                      className="bg-army-tan hover:bg-[#9e8562] disabled:opacity-50 text-army-text font-mono text-xs tracking-widest uppercase px-5 py-2 transition-colors">
                      {genOpord ? 'GENERATING...' : opord ? '↺ REGENERATE' : '⊞ GENERATE OPORD'}
                    </button>
                    {opord && !genOpord && (
                      <>
                        <button onClick={handleSaveOpord}
                          className="border border-border font-mono text-xs uppercase px-4 py-2 text-army-muted hover:text-army-text transition-colors">
                          SAVE
                        </button>
                        <button onClick={() => exportToPDF({
                          type: 'development-plan',
                          soldier: { name: selected.unit ?? 'Unit', rank: '' },
                          subtitle: `OPORD — ${eventTypeLabel(selected.event_type)}`,
                          content: opord,
                          filename: `opord-${selected.title.replace(/\s+/g, '-')}`,
                        })}
                          className="border border-border font-mono text-xs uppercase px-4 py-2 text-army-muted hover:text-army-text transition-colors">
                          ↓ PDF
                        </button>
                      </>
                    )}
                  </div>

                  {(opord || genOpord) ? (
                    <div className="bg-surface border border-border p-6">
                      <div className="space-y-1">{renderMarkdown(opord)}</div>
                      {genOpord && <span className="inline-block w-2 h-4 bg-army-gold ml-1 animate-pulse align-text-bottom" />}
                    </div>
                  ) : (
                    <div className="border border-border p-10 text-center font-mono text-army-muted text-sm">
                      Click "Generate OPORD" to produce a 5-paragraph operations order for this training event.
                    </div>
                  )}
                </div>
              )}

              {/* ── Lesson Plans tab ── */}
              {tab === 'lessons' && (
                <div className="max-w-3xl space-y-6">
                  {/* Generator form */}
                  <div className="bg-surface border border-army-tan p-5 space-y-4">
                    <div className="font-mono text-[10px] tracking-widest text-army-gold uppercase">Generate Lesson Plan (ALC Format)</div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Topic <span className="text-danger">*</span></label>
                        <input value={lpTopic} onChange={e => setLpTopic(e.target.value)}
                          placeholder="e.g. NCO Responsibilities, Effective Listening, Land Navigation, Risk Management, Ethical Leadership..."
                          className="w-full bg-bg border border-border px-3 py-2 font-mono text-sm text-army-text placeholder-army-muted focus:outline-none focus:border-army-tan" />
                      </div>
                      <div>
                        <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Duration</label>
                        <select value={lpDuration} onChange={e => setLpDuration(+e.target.value)}
                          className="w-full bg-bg border border-border px-3 py-2 font-mono text-sm text-army-text focus:outline-none focus:border-army-tan">
                          {LESSON_DURATIONS.map(d => <option key={d} value={d}>{d} minutes</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Target Audience</label>
                        <input value={lpAudience} onChange={e => setLpAudience(e.target.value)}
                          placeholder="All Soldiers / Junior NCOs / SSG+"
                          className="w-full bg-bg border border-border px-3 py-2 font-mono text-sm text-army-text placeholder-army-muted focus:outline-none focus:border-army-tan" />
                      </div>
                      <div className="col-span-2">
                        <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Additional Context (optional)</label>
                        <input value={lpContext} onChange={e => setLpContext(e.target.value)}
                          placeholder="Unit background, specific scenarios to include, TXSG context..."
                          className="w-full bg-bg border border-border px-3 py-2 font-mono text-sm text-army-text placeholder-army-muted focus:outline-none focus:border-army-tan" />
                      </div>
                    </div>

                    <button onClick={handleGenLesson} disabled={!lpTopic.trim() || genLP}
                      className="bg-army-tan hover:bg-[#9e8562] disabled:opacity-40 text-army-text font-mono text-xs tracking-widest uppercase px-5 py-2.5 transition-colors">
                      {genLP ? 'GENERATING...' : '◈ GENERATE LESSON PLAN'}
                    </button>
                  </div>

                  {/* Generated lesson output */}
                  {(lpOutput || genLP) && (
                    <div className="bg-surface border border-border p-6">
                      <div className="space-y-1">{renderMarkdown(lpOutput)}</div>
                      {genLP && <span className="inline-block w-2 h-4 bg-army-gold ml-1 animate-pulse align-text-bottom" />}
                    </div>
                  )}

                  {lpOutput && !genLP && (
                    <div className="flex gap-3">
                      <button onClick={handleSaveLesson} disabled={savingLP}
                        className="bg-army-tan hover:bg-[#9e8562] disabled:opacity-50 text-army-text font-mono text-xs tracking-widest uppercase px-5 py-2 transition-colors">
                        {savingLP ? 'SAVING...' : 'SAVE LESSON PLAN'}
                      </button>
                      <button onClick={() => exportToPDF({
                        type: 'development-plan',
                        soldier: { name: lpAudience, rank: '' },
                        subtitle: `Lesson Plan — ${lpTopic}`,
                        content: lpOutput,
                        filename: `lesson-plan-${lpTopic.replace(/\s+/g, '-')}`,
                      })}
                        className="border border-border text-army-muted hover:text-army-text font-mono text-xs uppercase px-5 py-2 transition-colors">
                        ↓ PDF
                      </button>
                    </div>
                  )}

                  {/* Saved lessons for this event */}
                  {eventLessons.length > 0 && (
                    <div>
                      <div className="font-mono text-[10px] tracking-widest text-army-muted uppercase mb-3">
                        Saved Lesson Plans ({eventLessons.length})
                      </div>
                      <div className="space-y-2">
                        {eventLessons.map(lp => (
                          <div key={lp.id} className="bg-surface border border-border p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-mono text-sm text-army-gold font-bold">{lp.title}</div>
                                <div className="font-mono text-[10px] text-army-muted mt-0.5">
                                  {lp.duration_min} min · {lp.target_audience}
                                </div>
                              </div>
                              <button onClick={() => exportToPDF({
                                type: 'development-plan',
                                soldier: { name: lp.target_audience, rank: '' },
                                subtitle: `Lesson Plan — ${lp.title}`,
                                content: lp.content_outline ?? '',
                                filename: `lesson-plan-${lp.title.replace(/\s+/g, '-')}`,
                              })}
                                className="font-mono text-[10px] text-army-muted hover:text-army-text border border-border px-3 py-1 transition-colors">
                                ↓ PDF
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!selected && !showNew && !loading && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-sm">
              <div className="font-mono text-4xl text-army-muted mb-3">▣</div>
              <div className="font-mono text-sm text-army-muted">
                Plan your next training event.<br />
                Drill weekends, Annual Training,<br />
                or any training day — AI helps with<br />
                the OPORD, schedule, and lesson plans.
              </div>
              <button onClick={() => setShowNew(true)}
                className="mt-4 bg-army-tan hover:bg-[#9e8562] text-army-text font-mono text-xs tracking-widest uppercase px-5 py-2.5 transition-colors">
                + CREATE FIRST EVENT
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
