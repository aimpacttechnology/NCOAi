import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export interface Task {
  id: string;
  soldier_id: string;
  nco_id: string;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  status: string;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  soldiers?: { rank: string; first_name: string; last_name: string };
}

export const CATEGORIES = ['General', 'Training', 'Admin', 'Physical', 'Development', 'Counseling', 'Equipment'];
export const PRIORITIES  = ['Low', 'Normal', 'High', 'Urgent'];

const PRIORITY_COLOR: Record<string, string> = {
  Low:    'text-army-muted border-army-muted',
  Normal: 'text-army-text border-border',
  High:   'text-yellow-400 border-yellow-700',
  Urgent: 'text-danger border-danger',
};

const STATUS_COLOR: Record<string, string> = {
  pending:     'text-army-muted',
  in_progress: 'text-yellow-400',
  complete:    'text-green-400',
};

function daysUntil(date: string) {
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
}

function DueBadge({ date }: { date: string | null }) {
  if (!date) return null;
  const d = daysUntil(date);
  const label = d < 0 ? `${Math.abs(d)}d overdue` : d === 0 ? 'Due today' : `Due in ${d}d`;
  const color = d < 0 ? 'text-danger' : d <= 3 ? 'text-yellow-400' : 'text-army-muted';
  return <span className={`font-mono text-[10px] ${color}`}>{label}</span>;
}

interface TaskRowProps {
  task: Task;
  onToggle: (t: Task) => void;
  onDelete: (id: string) => void;
  showSoldier?: boolean;
}

export function TaskRow({ task, onToggle, onDelete, showSoldier = true }: TaskRowProps) {
  const navigate = useNavigate();
  const done = task.status === 'complete';

  return (
    <div className={`flex items-start gap-3 bg-surface border border-border px-4 py-3 transition-opacity ${done ? 'opacity-50' : ''}`}>
      <button
        onClick={() => onToggle(task)}
        className={`mt-0.5 w-5 h-5 flex-shrink-0 border font-mono text-xs flex items-center justify-center transition-colors ${
          done ? 'bg-green-900 border-green-700 text-green-400' : 'border-border hover:border-army-tan'
        }`}
      >
        {done ? '✓' : ''}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`font-mono text-sm ${done ? 'line-through text-army-muted' : 'text-army-text'}`}>
            {task.title}
          </span>
          <span className={`font-mono text-[10px] border px-1.5 py-0.5 ${PRIORITY_COLOR[task.priority]}`}>
            {task.priority}
          </span>
          <span className="font-mono text-[10px] text-army-muted border border-border px-1.5 py-0.5">
            {task.category}
          </span>
        </div>

        {task.description && (
          <div className="font-mono text-xs text-army-muted mt-0.5 truncate">{task.description}</div>
        )}

        <div className="flex items-center gap-3 mt-1">
          {showSoldier && task.soldiers && (
            <button
              onClick={() => navigate(`/soldiers/${task.soldier_id}`)}
              className="font-mono text-[10px] text-army-gold hover:underline"
            >
              {task.soldiers.rank} {task.soldiers.last_name}
            </button>
          )}
          <DueBadge date={task.due_date} />
          {done && task.completed_at && (
            <span className="font-mono text-[10px] text-green-500">
              Completed {new Date(task.completed_at).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      <button onClick={() => onDelete(task.id)} className="font-mono text-[10px] text-army-muted hover:text-danger transition-colors flex-shrink-0 mt-1">
        ✕
      </button>
    </div>
  );
}

const BLANK = { title: '', description: '', category: 'General', priority: 'Normal', due_date: '', soldier_id: '' };

export default function Tasks() {
  const [tasks, setTasks]       = useState<Task[]>([]);
  const [soldiers, setSoldiers] = useState<{ id: string; rank: string; first_name: string; last_name: string }[]>([]);
  const [filter, setFilter]     = useState<'all' | 'pending' | 'overdue' | 'complete'>('pending');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState(BLANK);
  const [saving, setSaving]     = useState(false);
  const [userId, setUserId]     = useState('');
  const [loading, setLoading]   = useState(true);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const [taskRes, solRes] = await Promise.all([
      supabase.from('tasks')
        .select('*, soldiers(rank, first_name, last_name)')
        .eq('nco_id', user.id)
        .order('due_date', { ascending: true, nullsFirst: false }),
      supabase.from('soldiers').select('id, rank, first_name, last_name').eq('nco_id', user.id).order('last_name'),
    ]);

    if (taskRes.data) setTasks(taskRes.data as Task[]);
    if (solRes.data)  setSoldiers(solRes.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggle = async (task: Task) => {
    const done = task.status !== 'complete';
    const update = { status: done ? 'complete' : 'pending', completed_at: done ? new Date().toISOString() : null };
    await supabase.from('tasks').update(update).eq('id', task.id);
    setTasks(ts => ts.map(t => t.id === task.id ? { ...t, ...update } : t));
  };

  const remove = async (id: string) => {
    await supabase.from('tasks').delete().eq('id', id);
    setTasks(ts => ts.filter(t => t.id !== id));
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.soldier_id) return;
    setSaving(true);
    const { data } = await supabase.from('tasks').insert({
      ...form,
      nco_id: userId,
      due_date: form.due_date || null,
      description: form.description || null,
    }).select('*, soldiers(rank, first_name, last_name)').single();
    if (data) {
      setTasks(ts => [data as Task, ...ts]);
      setForm(BLANK);
      setShowForm(false);
    }
    setSaving(false);
  };

  const now = new Date().toISOString().split('T')[0];
  const filtered = tasks.filter(t => {
    if (filter === 'pending')  return t.status !== 'complete';
    if (filter === 'overdue')  return t.status !== 'complete' && t.due_date && t.due_date < now;
    if (filter === 'complete') return t.status === 'complete';
    return true;
  });

  const overdue  = tasks.filter(t => t.status !== 'complete' && t.due_date && t.due_date < now).length;
  const open     = tasks.filter(t => t.status !== 'complete').length;
  const doneThis = tasks.filter(t => t.status === 'complete' && t.completed_at?.startsWith(now.slice(0, 7))).length;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">NCO Duty</div>
          <h1 className="text-xl font-bold text-army-text">Task Tracker</h1>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="bg-army-tan hover:bg-[#9e8562] text-army-text font-mono text-xs tracking-widest uppercase px-4 py-2 transition-colors">
          + ADD TASK
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Open Tasks',        value: open,     accent: false },
          { label: 'Overdue',           value: overdue,  accent: overdue > 0 },
          { label: 'Completed (month)', value: doneThis, accent: false },
        ].map(s => (
          <div key={s.label} className="bg-surface border border-border p-4">
            <div className="font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">{s.label}</div>
            <div className={`font-mono text-2xl font-bold ${s.accent ? 'text-danger' : 'text-army-gold'}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Add task form */}
      {showForm && (
        <form onSubmit={handleAdd} className="bg-surface border border-army-tan p-5 mb-6 space-y-4">
          <div className="font-mono text-xs tracking-widest text-army-gold uppercase">New Task</div>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Title <span className="text-danger">*</span></label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required
                className="w-full bg-bg border border-border px-3 py-2 font-mono text-sm text-army-text focus:outline-none focus:border-army-tan" />
            </div>
            <div>
              <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Soldier <span className="text-danger">*</span></label>
              <select value={form.soldier_id} onChange={e => setForm(f => ({ ...f, soldier_id: e.target.value }))} required
                className="w-full bg-bg border border-border px-3 py-2 font-mono text-sm text-army-text focus:outline-none focus:border-army-tan">
                <option value="">-- Select --</option>
                {soldiers.map(s => <option key={s.id} value={s.id}>{s.rank} {s.last_name}, {s.first_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Due Date</label>
              <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                className="w-full bg-bg border border-border px-3 py-2 font-mono text-sm text-army-text focus:outline-none focus:border-army-tan" />
            </div>
            <div>
              <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Category</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full bg-bg border border-border px-3 py-2 font-mono text-sm text-army-text focus:outline-none focus:border-army-tan">
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Priority</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                className="w-full bg-bg border border-border px-3 py-2 font-mono text-sm text-army-text focus:outline-none focus:border-army-tan">
                {PRIORITIES.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Description</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Optional details..."
                className="w-full bg-bg border border-border px-3 py-2 font-mono text-sm text-army-text placeholder-army-muted focus:outline-none focus:border-army-tan" />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={saving}
              className="bg-army-tan hover:bg-[#9e8562] disabled:opacity-50 text-army-text font-mono text-xs tracking-widest uppercase px-5 py-2 transition-colors">
              {saving ? 'SAVING...' : 'ADD TASK'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setForm(BLANK); }}
              className="border border-border font-mono text-xs tracking-widest uppercase px-5 py-2 text-army-muted hover:text-army-text transition-colors">
              CANCEL
            </button>
          </div>
        </form>
      )}

      {/* Filter tabs */}
      <div className="flex border-b border-border mb-4">
        {(['pending', 'overdue', 'complete', 'all'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 font-mono text-xs tracking-wider transition-colors capitalize ${
              filter === f ? 'border-b-2 border-army-gold text-army-gold' : 'text-army-muted hover:text-army-text'
            }`}>
            {f}{f === 'overdue' && overdue > 0 ? ` (${overdue})` : ''}
          </button>
        ))}
      </div>

      {/* Task list */}
      {loading ? (
        <div className="font-mono text-army-muted text-sm py-8 text-center">Loading tasks...</div>
      ) : filtered.length === 0 ? (
        <div className="border border-border p-10 text-center">
          <div className="font-mono text-army-muted text-sm">
            {filter === 'overdue' ? 'No overdue tasks.' : filter === 'complete' ? 'No completed tasks.' : 'No open tasks.'}
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(t => (
            <TaskRow key={t.id} task={t} onToggle={toggle} onDelete={remove} showSoldier />
          ))}
        </div>
      )}
    </div>
  );
}
