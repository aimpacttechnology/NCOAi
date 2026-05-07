import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { TaskRow, CATEGORIES, PRIORITIES, type Task } from './Tasks';
import MarkdownOutput from '../components/MarkdownOutput';

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

type Tab = 'overview' | 'history' | 'tasks' | 'notes';

const RANKS = ['PVT','PV2','PFC','SPC','CPL','SGT','SSG','SFC','MSG','1SG','SGM','CSM'];
const TASK_BLANK = { title: '', description: '', category: 'General', priority: 'Normal', due_date: '' };

export default function SoldierDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [soldier, setSoldier]             = useState<Soldier | null>(null);
  const [counselings, setCounselings]     = useState<Counseling[]>([]);
  const [tasks, setTasks]                 = useState<Task[]>([]);
  const [tab, setTab]                     = useState<Tab>('overview');
  const [notes, setNotes]                 = useState('');
  const [savingNotes, setSavingNotes]     = useState(false);
  const [expandedCounseling, setExpandedCounseling] = useState<string | null>(null);
  const [showTaskForm, setShowTaskForm]   = useState(false);
  const [taskForm, setTaskForm]           = useState(TASK_BLANK);
  const [savingTask, setSavingTask]       = useState(false);
  const [userId, setUserId]               = useState('');
  const [loading, setLoading]             = useState(true);

  // Edit state
  const [editing, setEditing]             = useState(false);
  const [editForm, setEditForm]           = useState({ first_name: '', last_name: '', rank: '', mos: '' });
  const [saving, setSaving]               = useState(false);
  const [editError, setEditError]         = useState('');

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);

      const [soldierRes, counselingsRes, tasksRes] = await Promise.all([
        supabase.from('soldiers').select('*').eq('id', id).single(),
        supabase.from('counselings').select('*').eq('soldier_id', id).order('created_at', { ascending: false }),
        supabase.from('tasks').select('*').eq('soldier_id', id).order('due_date', { ascending: true, nullsFirst: false }),
      ]);

      if (soldierRes.data) {
        setSoldier(soldierRes.data);
        setNotes(soldierRes.data.notes ?? '');
        setEditForm({
          first_name: soldierRes.data.first_name,
          last_name:  soldierRes.data.last_name,
          rank:       soldierRes.data.rank,
          mos:        soldierRes.data.mos ?? '',
        });
      }
      if (counselingsRes.data) setCounselings(counselingsRes.data);
      if (tasksRes.data) setTasks(tasksRes.data);
      setLoading(false);
    };
    load();
  }, [id]);

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !editForm.first_name.trim() || !editForm.last_name.trim()) return;
    setSaving(true);
    setEditError('');

    const { error } = await supabase.from('soldiers').update({
      first_name: editForm.first_name.trim(),
      last_name:  editForm.last_name.trim(),
      rank:       editForm.rank,
      mos:        editForm.mos.trim() || null,
    }).eq('id', id);

    if (error) {
      setEditError(error.message);
    } else {
      setSoldier(s => s ? { ...s, ...editForm, mos: editForm.mos.trim() || null } : s);
      setEditing(false);
    }
    setSaving(false);
  };

  const saveNotes = async () => {
    if (!id) return;
    setSavingNotes(true);
    await supabase.from('soldiers').update({ notes }).eq('id', id);
    setSavingNotes(false);
  };

  const toggleTask = async (task: Task) => {
    const done = task.status !== 'complete';
    const update = { status: done ? 'complete' : 'pending', completed_at: done ? new Date().toISOString() : null };
    await supabase.from('tasks').update(update).eq('id', task.id);
    setTasks(ts => ts.map(t => t.id === task.id ? { ...t, ...update } : t));
  };

  const deleteTask = async (tid: string) => {
    await supabase.from('tasks').delete().eq('id', tid);
    setTasks(ts => ts.filter(t => t.id !== tid));
  };

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskForm.title.trim() || !id || !userId) return;
    setSavingTask(true);
    const { data } = await supabase.from('tasks').insert({
      ...taskForm,
      soldier_id: id,
      nco_id: userId,
      due_date: taskForm.due_date || null,
      description: taskForm.description || null,
    }).select('*').single();
    if (data) { setTasks(ts => [...ts, data]); setTaskForm(TASK_BLANK); setShowTaskForm(false); }
    setSavingTask(false);
  };

  if (loading) return <div className="p-8 font-mono text-army-muted">LOADING...</div>;
  if (!soldier) return <div className="p-8 font-mono text-danger">Soldier not found.</div>;

  const openTasks = tasks.filter(t => t.status !== 'complete').length;

  const TABS: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'OVERVIEW' },
    { key: 'history',  label: `COUNSELING (${counselings.length})` },
    { key: 'tasks',    label: `TASKS (${openTasks} open)` },
    { key: 'notes',    label: 'NOTES' },
  ];

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <button onClick={() => navigate('/soldiers')}
        className="font-mono text-xs text-army-muted hover:text-army-text mb-6 flex items-center gap-2 transition-colors">
        ← BACK TO ROSTER
      </button>

      {/* Header */}
      <div className="bg-surface border border-border p-6 mb-6">
        {editing ? (
          <form onSubmit={saveEdit} className="space-y-4">
            <div className="font-mono text-[10px] tracking-widest text-army-gold uppercase mb-3">Edit Soldier</div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">First Name</label>
                <input
                  value={editForm.first_name}
                  onChange={e => setEditForm(f => ({ ...f, first_name: e.target.value }))}
                  required
                  className="w-full bg-bg border border-border px-3 py-2 font-mono text-sm text-army-text focus:outline-none focus:border-army-tan"
                />
              </div>
              <div>
                <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Last Name</label>
                <input
                  value={editForm.last_name}
                  onChange={e => setEditForm(f => ({ ...f, last_name: e.target.value }))}
                  required
                  className="w-full bg-bg border border-border px-3 py-2 font-mono text-sm text-army-text focus:outline-none focus:border-army-tan"
                />
              </div>
              <div>
                <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Rank</label>
                <select
                  value={editForm.rank}
                  onChange={e => setEditForm(f => ({ ...f, rank: e.target.value }))}
                  className="w-full bg-bg border border-border px-3 py-2 font-mono text-sm text-army-text focus:outline-none focus:border-army-tan"
                >
                  {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">MOS</label>
                <input
                  value={editForm.mos}
                  onChange={e => setEditForm(f => ({ ...f, mos: e.target.value }))}
                  placeholder="e.g. 11B"
                  className="w-full bg-bg border border-border px-3 py-2 font-mono text-sm text-army-text placeholder-army-muted focus:outline-none focus:border-army-tan"
                />
              </div>
            </div>
            {editError && <div className="font-mono text-xs text-danger">{editError}</div>}
            <div className="flex gap-3">
              <button type="submit" disabled={saving}
                className="bg-army-tan hover:bg-[#9e8562] disabled:opacity-50 text-army-text font-mono text-xs tracking-widest uppercase px-5 py-2 transition-colors">
                {saving ? 'SAVING...' : 'SAVE'}
              </button>
              <button type="button" onClick={() => { setEditing(false); setEditError(''); }}
                className="border border-border text-army-muted hover:text-army-text font-mono text-xs tracking-widest uppercase px-5 py-2 transition-colors">
                CANCEL
              </button>
            </div>
          </form>
        ) : (
          <div className="flex items-start justify-between">
            <div>
              <div className="font-mono text-army-gold text-lg font-bold">
                {soldier.rank} {soldier.last_name}, {soldier.first_name}
              </div>
              <div className="font-mono text-army-muted text-xs mt-1">
                MOS: {soldier.mos || '—'} &nbsp;|&nbsp; Added: {new Date(soldier.created_at).toLocaleDateString()}
              </div>
            </div>
            <button
              onClick={() => setEditing(true)}
              className="font-mono text-[10px] tracking-widest uppercase text-army-muted hover:text-army-text border border-border hover:border-army-tan px-3 py-1.5 transition-colors flex-shrink-0"
            >
              ✎ EDIT
            </button>
          </div>
        )}
      </div>

      <div className="flex border-b border-border mb-6">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 font-mono text-xs tracking-wider transition-colors ${
              tab === t.key ? 'border-b-2 border-army-gold text-army-gold' : 'text-army-muted hover:text-army-text'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Full Name',         value: `${soldier.rank} ${soldier.first_name} ${soldier.last_name}` },
              { label: 'MOS',               value: soldier.mos || 'Not assigned' },
              { label: 'Total Counselings', value: String(counselings.length) },
              { label: 'Open Tasks',        value: String(openTasks) },
              { label: 'Last Counseled',    value: counselings[0] ? new Date(counselings[0].created_at).toLocaleDateString() : 'Never' },
              { label: 'Added',             value: new Date(soldier.created_at).toLocaleDateString() },
            ].map(({ label, value }) => (
              <div key={label} className="bg-surface border border-border p-4">
                <div className="font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">{label}</div>
                <div className="font-mono text-sm text-army-text">{value}</div>
              </div>
            ))}
          </div>
          <button onClick={() => navigate('/counseling/new')}
            className="bg-army-tan hover:bg-[#9e8562] text-army-text font-mono text-xs tracking-widest uppercase px-5 py-2.5 transition-colors">
            + NEW COUNSELING
          </button>
        </div>
      )}

      {/* Counseling History */}
      {tab === 'history' && (
        <div className="space-y-3">
          {counselings.length === 0 ? (
            <div className="border border-border p-8 text-center font-mono text-army-muted text-sm">No counselings on record.</div>
          ) : counselings.map(c => (
            <div key={c.id} className="border border-border bg-surface">
              <button onClick={() => setExpandedCounseling(expandedCounseling === c.id ? null : c.id)}
                className="w-full text-left px-4 py-3 flex items-center justify-between">
                <div>
                  <span className="font-mono text-xs text-army-gold uppercase">{c.type}</span>
                  <span className="font-mono text-xs text-army-muted ml-3">{new Date(c.created_at).toLocaleDateString()}</span>
                </div>
                <span className="font-mono text-xs text-army-muted">{expandedCounseling === c.id ? '▲' : '▼'}</span>
              </button>
              {expandedCounseling === c.id && c.generated_output && (
                <div className="px-4 pb-4 border-t border-border pt-3">
                  <MarkdownOutput content={c.generated_output} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tasks */}
      {tab === 'tasks' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowTaskForm(!showTaskForm)}
              className="bg-army-tan hover:bg-[#9e8562] text-army-text font-mono text-xs tracking-widest uppercase px-4 py-2 transition-colors">
              + ADD TASK
            </button>
          </div>

          {showTaskForm && (
            <form onSubmit={addTask} className="bg-surface border border-army-tan p-4 space-y-3">
              <input value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Task title *" required
                className="w-full bg-bg border border-border px-3 py-2 font-mono text-sm text-army-text placeholder-army-muted focus:outline-none focus:border-army-tan" />
              <div className="grid grid-cols-3 gap-3">
                <input type="date" value={taskForm.due_date} onChange={e => setTaskForm(f => ({ ...f, due_date: e.target.value }))}
                  className="bg-bg border border-border px-3 py-2 font-mono text-sm text-army-text focus:outline-none focus:border-army-tan" />
                <select value={taskForm.category} onChange={e => setTaskForm(f => ({ ...f, category: e.target.value }))}
                  className="bg-bg border border-border px-3 py-2 font-mono text-sm text-army-text focus:outline-none focus:border-army-tan">
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
                <select value={taskForm.priority} onChange={e => setTaskForm(f => ({ ...f, priority: e.target.value }))}
                  className="bg-bg border border-border px-3 py-2 font-mono text-sm text-army-text focus:outline-none focus:border-army-tan">
                  {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={savingTask}
                  className="bg-army-tan hover:bg-[#9e8562] disabled:opacity-50 text-army-text font-mono text-xs tracking-widest uppercase px-5 py-2 transition-colors">
                  {savingTask ? 'SAVING...' : 'ADD'}
                </button>
                <button type="button" onClick={() => { setShowTaskForm(false); setTaskForm(TASK_BLANK); }}
                  className="border border-border font-mono text-xs uppercase px-5 py-2 text-army-muted hover:text-army-text transition-colors">
                  CANCEL
                </button>
              </div>
            </form>
          )}

          {tasks.length === 0 ? (
            <div className="border border-border p-8 text-center font-mono text-army-muted text-sm">No tasks assigned.</div>
          ) : (
            <div className="space-y-1.5">
              {tasks.map(t => <TaskRow key={t.id} task={t} onToggle={toggleTask} onDelete={deleteTask} showSoldier={false} />)}
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      {tab === 'notes' && (
        <div className="space-y-3">
          <div className="font-mono text-xs text-army-muted mb-2">Private notes — not part of official record.</div>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={10}
            className="w-full bg-surface border border-border px-4 py-3 font-mono text-sm text-army-text placeholder-army-muted focus:outline-none focus:border-army-tan resize-none"
            placeholder="Add your notes here..." />
          <button onClick={saveNotes} disabled={savingNotes}
            className="bg-army-tan hover:bg-[#9e8562] disabled:opacity-50 text-army-text font-mono text-xs tracking-widest uppercase px-5 py-2.5 transition-colors">
            {savingNotes ? 'SAVING...' : 'SAVE NOTES'}
          </button>
        </div>
      )}
    </div>
  );
}
