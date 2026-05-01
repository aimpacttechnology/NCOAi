import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { assistJournal } from '../lib/api';

interface Entry {
  id: string;
  title: string;
  content: string;
  tags: string[];
  created_at: string;
}

const TAG_OPTIONS = [
  'Leadership', 'Mentorship', 'Discipline', 'Counseling',
  'Promotion', 'Training', 'Morale', 'Ethics', 'Doctrine',
  'Lessons Learned', 'TXSG', 'Field Craft',
];

export default function WisdomJournal() {
  const [entries, setEntries]       = useState<Entry[]>([]);
  const [selected, setSelected]     = useState<Entry | null>(null);
  const [showNew, setShowNew]       = useState(false);
  const [rawThought, setRawThought] = useState('');
  const [context, setContext]       = useState('');
  const [aiOutput, setAiOutput]     = useState('');
  const [assisting, setAssisting]   = useState(false);
  const [title, setTitle]           = useState('');
  const [finalContent, setFinalContent] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [saving, setSaving]         = useState(false);
  const [userId, setUserId]         = useState('');
  const [loading, setLoading]       = useState(true);
  const [searchTag, setSearchTag]   = useState('');

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    const { data } = await supabase.from('wisdom_journal').select('*')
      .eq('nco_id', user.id).order('created_at', { ascending: false });
    if (data) setEntries(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleAssist = async () => {
    if (!rawThought.trim()) return;
    setAssisting(true);
    setAiOutput('');
    try {
      await assistJournal({ rawThought, context }, chunk => setAiOutput(p => p + chunk));
    } catch {
      setAiOutput('Failed to assist. Check server connection.');
    } finally {
      setAssisting(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim() || !finalContent.trim() || !userId) return;
    setSaving(true);
    const { data, error } = await supabase.from('wisdom_journal').insert({
      nco_id: userId,
      title: title.trim(),
      content: finalContent.trim(),
      tags: selectedTags,
    }).select().single();

    if (!error && data) {
      setEntries(e => [data, ...e]);
      setSelected(data);
      setShowNew(false);
      setRawThought(''); setContext(''); setAiOutput('');
      setTitle(''); setFinalContent(''); setSelectedTags([]);
    }
    setSaving(false);
  };

  const useAiDraft = () => {
    setFinalContent(aiOutput);
    const titleMatch = aiOutput.match(/^#+ (.+)/m);
    if (titleMatch && !title) setTitle(titleMatch[1]);
  };

  const toggleTag = (t: string) =>
    setSelectedTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);

  const filtered = searchTag
    ? entries.filter(e => e.tags.includes(searchTag))
    : entries;

  return (
    <div className="flex h-full">
      {/* ── Entry list ── */}
      <div className="w-72 flex-shrink-0 border-r border-border flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <div className="font-mono text-[10px] tracking-widest text-army-muted uppercase">Step 4</div>
            <div className="font-mono text-sm font-bold text-army-text mt-0.5">Wisdom Journal</div>
          </div>
          <button onClick={() => { setShowNew(true); setSelected(null); }}
            className="bg-army-tan hover:bg-[#9e8562] text-army-text font-mono text-[10px] tracking-widest uppercase px-3 py-1.5 transition-colors">
            + NEW
          </button>
        </div>

        {/* Tag filter */}
        <div className="px-4 py-2 border-b border-border">
          <select value={searchTag} onChange={e => setSearchTag(e.target.value)}
            className="w-full bg-surface border border-border px-2 py-1.5 font-mono text-xs text-army-text focus:outline-none focus:border-army-tan">
            <option value="">All entries</option>
            {TAG_OPTIONS.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {loading ? <div className="px-5 py-4 font-mono text-xs text-army-muted">Loading...</div>
            : filtered.length === 0 ? (
              <div className="px-5 py-8 text-center font-mono text-xs text-army-muted">
                {searchTag ? `No entries tagged "${searchTag}"` : 'No entries yet.\nCapture your first lesson.'}
              </div>
            ) : filtered.map(e => (
              <button key={e.id} onClick={() => { setSelected(e); setShowNew(false); }}
                className={`w-full text-left px-5 py-3 border-b border-border transition-colors ${selected?.id === e.id ? 'bg-army-tan' : 'hover:bg-[#21262d]'}`}>
                <div className="font-mono text-xs font-bold text-army-text leading-snug">{e.title}</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {e.tags.slice(0, 3).map(t => (
                    <span key={t} className="font-mono text-[9px] text-army-muted border border-border px-1">{t}</span>
                  ))}
                </div>
                <div className="font-mono text-[10px] text-army-muted mt-1">
                  {new Date(e.created_at).toLocaleDateString()}
                </div>
              </button>
            ))}
        </div>
      </div>

      {/* ── Detail / New ── */}
      <div className="flex-1 overflow-y-auto p-8">
        {/* View entry */}
        {selected && !showNew && (
          <div className="max-w-2xl">
            <div className="mb-4">
              <div className="font-mono text-army-gold text-xl font-bold">{selected.title}</div>
              <div className="flex items-center gap-3 mt-1">
                <div className="font-mono text-xs text-army-muted">
                  {new Date(selected.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
                <div className="flex gap-1">
                  {selected.tags.map(t => (
                    <span key={t} className="font-mono text-[9px] text-army-tan border border-army-tan px-1.5 py-0.5">{t}</span>
                  ))}
                </div>
              </div>
            </div>
            <div className="bg-surface border border-border p-6">
              <div className="font-mono text-sm text-army-text whitespace-pre-wrap leading-relaxed">
                {selected.content}
              </div>
            </div>
          </div>
        )}

        {/* New entry */}
        {showNew && (
          <div className="max-w-2xl">
            <div className="mb-6">
              <div className="font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">New Entry</div>
              <div className="font-mono text-xl font-bold text-army-text">Capture a Lesson</div>
              <div className="font-mono text-xs text-army-muted mt-1">
                Start with a brain dump. The AI will help you shape it into something worth passing on.
              </div>
            </div>

            <div className="space-y-4">
              {/* Brain dump */}
              <div>
                <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">
                  Raw Thought / Brain Dump <span className="text-danger">*</span>
                </label>
                <textarea rows={5} value={rawThought} onChange={e => setRawThought(e.target.value)}
                  placeholder="Just write it down — doesn't need to be polished. What happened? What did you learn? What do you wish someone had told you earlier?"
                  className="w-full bg-surface border border-border px-3 py-2.5 font-mono text-sm text-army-text placeholder-army-muted focus:outline-none focus:border-army-tan resize-none" />
              </div>

              <div>
                <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Context (optional)</label>
                <input value={context} onChange={e => setContext(e.target.value)}
                  placeholder="e.g. TXSG drill weekend, counseling a struggling soldier, NTC rotation..."
                  className="w-full bg-surface border border-border px-3 py-2.5 font-mono text-sm text-army-text placeholder-army-muted focus:outline-none focus:border-army-tan" />
              </div>

              <button onClick={handleAssist} disabled={!rawThought.trim() || assisting}
                className="w-full border border-army-gold text-army-gold hover:bg-army-gold hover:text-bg disabled:opacity-40 font-mono text-sm tracking-wider uppercase py-3 transition-colors">
                {assisting ? 'SHAPING YOUR THOUGHT...' : '★ SHAPE WITH AI'}
              </button>

              {/* AI output */}
              {(aiOutput || assisting) && (
                <div className="bg-surface border border-army-gold p-5">
                  <div className="font-mono text-[10px] tracking-widest text-army-gold uppercase mb-3">AI Draft</div>
                  <div className="font-mono text-sm text-army-text whitespace-pre-wrap leading-relaxed mb-3">
                    {aiOutput}
                    {assisting && <span className="inline-block w-2 h-4 bg-army-gold ml-0.5 animate-pulse align-text-bottom" />}
                  </div>
                  {!assisting && aiOutput && (
                    <button onClick={useAiDraft}
                      className="font-mono text-xs text-army-gold border border-army-gold hover:bg-army-gold hover:text-bg px-4 py-1.5 transition-colors">
                      USE THIS DRAFT ↓
                    </button>
                  )}
                </div>
              )}

              {/* Final edit */}
              <div>
                <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Title</label>
                <input value={title} onChange={e => setTitle(e.target.value)}
                  placeholder="Give this lesson a name..."
                  className="w-full bg-surface border border-border px-3 py-2.5 font-mono text-sm text-army-text placeholder-army-muted focus:outline-none focus:border-army-tan" />
              </div>

              <div>
                <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">
                  Final Entry <span className="text-army-muted font-normal normal-case">(edit the draft or write your own)</span>
                </label>
                <textarea rows={8} value={finalContent} onChange={e => setFinalContent(e.target.value)}
                  placeholder="Your polished journal entry..."
                  className="w-full bg-surface border border-border px-3 py-2.5 font-mono text-sm text-army-text placeholder-army-muted focus:outline-none focus:border-army-tan resize-none" />
              </div>

              {/* Tags */}
              <div>
                <div className="font-mono text-[10px] tracking-widest text-army-muted uppercase mb-2">Tags</div>
                <div className="flex flex-wrap gap-1.5">
                  {TAG_OPTIONS.map(t => (
                    <button key={t} onClick={() => toggleTag(t)}
                      className={`font-mono text-xs px-2.5 py-1 transition-colors border ${selectedTags.includes(t) ? 'bg-army-tan border-army-tan text-army-text' : 'border-border text-army-muted hover:text-army-text'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <button onClick={handleSave} disabled={!title.trim() || !finalContent.trim() || saving}
                className="bg-army-tan hover:bg-[#9e8562] disabled:opacity-40 text-army-text font-mono text-xs tracking-widest uppercase px-6 py-2.5 transition-colors">
                {saving ? 'SAVING...' : 'SAVE TO JOURNAL'}
              </button>
            </div>
          </div>
        )}

        {!selected && !showNew && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-sm">
              <div className="font-mono text-4xl text-army-muted mb-3">◇</div>
              <div className="font-mono text-sm text-army-muted">
                The NCO corps runs on institutional knowledge.<br />
                Start capturing yours.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
