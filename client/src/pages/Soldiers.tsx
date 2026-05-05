import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import SoldierCard from '../components/SoldierCard';

interface Soldier {
  id: string;
  first_name: string;
  last_name: string;
  rank: string;
  mos: string | null;
  created_at: string;
  last_counseling?: string | null;
}

interface ParsedRow {
  first_name: string;
  last_name: string;
  rank: string;
  mos: string;
  notes: string;
  _errors: string[];
}

const RANKS = ['PVT','PV2','PFC','SPC','CPL','SGT','SSG','SFC','MSG','1SG','SGM','CSM'];
const EMPTY_FORM = { first_name: '', last_name: '', rank: 'SPC', mos: '' };

const HEADER_MAP: Record<string, string> = {
  'first name': 'first_name', firstname: 'first_name', fname: 'first_name',
  'given name': 'first_name', first_name: 'first_name',
  'last name': 'last_name', lastname: 'last_name', lname: 'last_name',
  surname: 'last_name', 'family name': 'last_name', last_name: 'last_name',
  rank: 'rank', grade: 'rank',
  mos: 'mos', aoc: 'mos', specialty: 'mos',
  notes: 'notes', note: 'notes', comments: 'notes', remarks: 'notes',
};

function normalizeHeader(h: string): string {
  return HEADER_MAP[h.toLowerCase().trim()] ?? h.toLowerCase().trim().replace(/\s+/g, '_');
}

function normalizeRank(r: string): string {
  return RANKS.find(rank => rank.toUpperCase() === r.toUpperCase().trim()) ?? r.toUpperCase().trim();
}

function downloadTemplate() {
  const csv = [
    'first_name,last_name,rank,mos,notes',
    'John,Smith,SGT,11B,Squad leader',
    'Jane,Doe,SPC,25U,',
  ].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = 'soldier-import-template.csv';
  a.click();
}

async function parseSpreadsheet(file: File): Promise<ParsedRow[]> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

  return raw.map(row => {
    const normalized: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      normalized[normalizeHeader(k)] = String(v).trim();
    }

    const errors: string[] = [];
    if (!normalized.first_name) errors.push('Missing first name');
    if (!normalized.last_name)  errors.push('Missing last name');
    if (!normalized.rank)       errors.push('Missing rank');
    else if (!RANKS.includes(normalizeRank(normalized.rank))) errors.push(`Unknown rank: ${normalized.rank}`);

    return {
      first_name: normalized.first_name ?? '',
      last_name:  normalized.last_name  ?? '',
      rank:       normalized.rank ? normalizeRank(normalized.rank) : '',
      mos:        normalized.mos   ?? '',
      notes:      normalized.notes ?? '',
      _errors:    errors,
    };
  });
}

export default function Soldiers() {
  const [soldiers, setSoldiers]       = useState<Soldier[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showForm, setShowForm]       = useState(false);
  const [form, setForm]               = useState(EMPTY_FORM);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');

  // Import state
  const [showImport, setShowImport]   = useState(false);
  const [parsedRows, setParsedRows]   = useState<ParsedRow[]>([]);
  const [parseError, setParseError]   = useState('');
  const [importing, setImporting]     = useState(false);
  const [importDone, setImportDone]   = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: soldierRows } = await supabase
      .from('soldiers')
      .select('*')
      .eq('nco_id', user.id)
      .order('last_name');

    if (!soldierRows) { setLoading(false); return; }

    const enriched = await Promise.all(soldierRows.map(async s => {
      const { data } = await supabase
        .from('counselings')
        .select('created_at')
        .eq('soldier_id', s.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      return { ...s, last_counseling: data?.created_at ?? null };
    }));

    setSoldiers(enriched);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim()) return;
    setSaving(true);
    setError('');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error: err } = await supabase.from('soldiers').insert({
      nco_id: user.id,
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      rank: form.rank,
      mos: form.mos.trim() || null,
    });

    if (err) {
      setError(err.message);
    } else {
      setShowForm(false);
      setForm(EMPTY_FORM);
      await load();
    }
    setSaving(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError('');
    setParsedRows([]);
    setImportDone('');
    try {
      const rows = await parseSpreadsheet(file);
      if (rows.length === 0) { setParseError('No rows found in file.'); return; }
      setParsedRows(rows);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Failed to parse file.');
    }
  };

  const handleImport = async () => {
    const valid = parsedRows.filter(r => r._errors.length === 0);
    if (valid.length === 0) return;

    setImporting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const rows = valid.map(r => ({
      nco_id:     user.id,
      first_name: r.first_name,
      last_name:  r.last_name,
      rank:       r.rank,
      mos:        r.mos || null,
      notes:      r.notes || null,
    }));

    const { error: err } = await supabase.from('soldiers').insert(rows);
    setImporting(false);

    if (err) {
      setParseError(err.message);
    } else {
      setImportDone(`${valid.length} soldier${valid.length !== 1 ? 's' : ''} imported.`);
      setParsedRows([]);
      if (fileRef.current) fileRef.current.value = '';
      await load();
    }
  };

  const resetImport = () => {
    setShowImport(false);
    setParsedRows([]);
    setParseError('');
    setImportDone('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const validCount   = parsedRows.filter(r => r._errors.length === 0).length;
  const invalidCount = parsedRows.filter(r => r._errors.length > 0).length;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="font-mono text-[10px] tracking-widest text-army-muted uppercase">Roster</div>
          <h1 className="text-xl font-bold text-army-text mt-0.5">Soldiers</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowImport(!showImport); setShowForm(false); }}
            className="border border-border hover:border-army-tan text-army-muted hover:text-army-text font-mono text-xs tracking-widest uppercase px-4 py-2 transition-colors"
          >
            ↑ IMPORT
          </button>
          <button
            onClick={() => { setShowForm(!showForm); setShowImport(false); }}
            className="bg-army-tan hover:bg-[#9e8562] text-army-text font-mono text-xs tracking-widest uppercase px-4 py-2 transition-colors"
          >
            + ADD SOLDIER
          </button>
        </div>
      </div>

      {/* Add Soldier Form */}
      {showForm && (
        <form onSubmit={handleAdd} className="bg-surface border border-army-tan p-5 mb-6 space-y-4">
          <div className="font-mono text-xs tracking-widest text-army-gold uppercase mb-2">New Soldier</div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">First Name</label>
              <input
                id="add-first-name"
                name="first_name"
                value={form.first_name}
                onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                required
                className="w-full bg-bg border border-border px-3 py-2 font-mono text-sm text-army-text focus:outline-none focus:border-army-tan"
              />
            </div>
            <div>
              <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Last Name</label>
              <input
                id="add-last-name"
                name="last_name"
                value={form.last_name}
                onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                required
                className="w-full bg-bg border border-border px-3 py-2 font-mono text-sm text-army-text focus:outline-none focus:border-army-tan"
              />
            </div>
            <div>
              <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Rank</label>
              <select
                id="add-rank"
                name="rank"
                value={form.rank}
                onChange={e => setForm(f => ({ ...f, rank: e.target.value }))}
                className="w-full bg-bg border border-border px-3 py-2 font-mono text-sm text-army-text focus:outline-none focus:border-army-tan"
              >
                {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">MOS</label>
              <input
                id="add-mos"
                name="mos"
                value={form.mos}
                onChange={e => setForm(f => ({ ...f, mos: e.target.value }))}
                placeholder="e.g. 11B"
                className="w-full bg-bg border border-border px-3 py-2 font-mono text-sm text-army-text placeholder-army-muted focus:outline-none focus:border-army-tan"
              />
            </div>
          </div>
          {error && <div className="font-mono text-xs text-danger">{error}</div>}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="bg-army-tan hover:bg-[#9e8562] disabled:opacity-50 text-army-text font-mono text-xs tracking-widest uppercase px-5 py-2 transition-colors"
            >
              {saving ? 'SAVING...' : 'SAVE'}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setError(''); }}
              className="border border-border text-army-muted hover:text-army-text font-mono text-xs tracking-widest uppercase px-5 py-2 transition-colors"
            >
              CANCEL
            </button>
          </div>
        </form>
      )}

      {/* Import Panel */}
      {showImport && (
        <div className="bg-surface border border-border p-5 mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="font-mono text-xs tracking-widest text-army-gold uppercase">Import from Spreadsheet</div>
            <button onClick={resetImport} className="font-mono text-[10px] text-army-muted hover:text-army-text tracking-widest uppercase">✕ CLOSE</button>
          </div>

          <div className="font-mono text-xs text-army-muted space-y-1">
            <div>Accepts <span className="text-army-tan">.xlsx</span>, <span className="text-army-tan">.xls</span>, and <span className="text-army-tan">.csv</span> files exported from Excel or Google Sheets.</div>
            <div>Required columns: <span className="text-army-text">first_name, last_name, rank</span> — optional: <span className="text-army-text">mos, notes</span></div>
          </div>

          <div className="flex gap-3 items-center">
            <label className="cursor-pointer bg-bg border border-border hover:border-army-tan px-4 py-2 font-mono text-xs tracking-widest uppercase text-army-muted hover:text-army-text transition-colors">
              SELECT FILE
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
            <button
              onClick={downloadTemplate}
              className="font-mono text-xs text-army-muted hover:text-army-tan tracking-widest uppercase transition-colors"
            >
              ↓ DOWNLOAD TEMPLATE
            </button>
          </div>

          {parseError && (
            <div className="bg-[#1f0e0d] border border-danger px-4 py-2 font-mono text-xs text-danger">{parseError}</div>
          )}

          {importDone && (
            <div className="bg-[#0d1f12] border border-green-700 px-4 py-2 font-mono text-xs text-green-400">✓ {importDone}</div>
          )}

          {parsedRows.length > 0 && (
            <div className="space-y-3">
              <div className="font-mono text-[10px] tracking-widest text-army-muted uppercase">
                Preview — {validCount} valid, {invalidCount} with errors
              </div>

              <div className="overflow-x-auto">
                <table className="w-full font-mono text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      {['Last Name','First Name','Rank','MOS','Status'].map(h => (
                        <th key={h} className="text-left px-2 py-1.5 text-[10px] tracking-widest text-army-muted uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.map((row, i) => (
                      <tr key={i} className={`border-b border-border ${row._errors.length > 0 ? 'opacity-50' : ''}`}>
                        <td className="px-2 py-1.5 text-army-text">{row.last_name || '—'}</td>
                        <td className="px-2 py-1.5 text-army-text">{row.first_name || '—'}</td>
                        <td className="px-2 py-1.5 text-army-tan">{row.rank || '—'}</td>
                        <td className="px-2 py-1.5 text-army-muted">{row.mos || '—'}</td>
                        <td className="px-2 py-1.5">
                          {row._errors.length === 0
                            ? <span className="text-green-400">✓ Ready</span>
                            : <span className="text-danger">{row._errors.join(', ')}</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {validCount > 0 && (
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="bg-army-tan hover:bg-[#9e8562] disabled:opacity-50 text-army-text font-mono text-xs tracking-widest uppercase px-5 py-2 transition-colors"
                >
                  {importing ? 'IMPORTING...' : `IMPORT ${validCount} SOLDIER${validCount !== 1 ? 'S' : ''}`}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="font-mono text-army-muted text-sm py-12 text-center">LOADING ROSTER...</div>
      ) : soldiers.length === 0 ? (
        <div className="border border-border p-12 text-center">
          <div className="font-mono text-army-muted text-sm">No soldiers on roster.</div>
          <div className="font-mono text-army-muted text-xs mt-1">Add soldiers manually or import from a spreadsheet.</div>
        </div>
      ) : (
        <div className="space-y-2">
          {soldiers.map(s => <SoldierCard key={s.id} soldier={s} />)}
        </div>
      )}
    </div>
  );
}
