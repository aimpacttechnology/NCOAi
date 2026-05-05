import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { listLibraryDocs, ingestDoc, deleteLibraryDoc } from '../lib/api';

interface LibraryDoc {
  doc_name: string;
  chunk_count: number;
}

type UploadStatus = 'idle' | 'uploading' | 'indexing' | 'done' | 'error';

export default function DocLibrary() {
  const [docs, setDocs]               = useState<LibraryDoc[]>([]);
  const [loading, setLoading]         = useState(true);
  const [listError, setListError]     = useState('');

  const [file, setFile]               = useState<File | null>(null);
  const [docName, setDocName]         = useState('');
  const [status, setStatus]           = useState<UploadStatus>('idle');
  const [statusMsg, setStatusMsg]     = useState('');
  const [indexedChunks, setIndexedChunks] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    setListError('');
    try {
      const result = await listLibraryDocs();
      setDocs(result);
    } catch (err) {
      setListError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (f) {
      setDocName(f.name);
    }
    setStatus('idle');
    setStatusMsg('');
  };

  const handleUpload = async () => {
    if (!file || !docName.trim()) return;
    setStatus('uploading');
    setStatusMsg('');

    try {
      // Read file as base64 and send directly to the ingest endpoint
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          resolve(dataUrl.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      setStatus('indexing');
      const result = await ingestDoc(base64, docName.trim());
      setIndexedChunks(result.chunks);
      setStatus('done');

      // Reset form
      setFile(null);
      setDocName('');
      if (fileInputRef.current) fileInputRef.current.value = '';

      // Refresh list
      await load();
    } catch (err) {
      setStatus('error');
      setStatusMsg(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDelete = async (name: string) => {
    if (!window.confirm(`Delete "${name}" from the doctrine library? This cannot be undone.`)) return;
    try {
      await deleteLibraryDoc(name);
      setDocs(prev => prev.filter(d => d.doc_name !== name));
    } catch (err) {
      alert(`Delete failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const canUpload = file !== null && docName.trim().length > 0 && (status === 'idle' || status === 'done' || status === 'error');
  const isBusy = status === 'uploading' || status === 'indexing';

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <div className="font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Army AI</div>
        <div className="font-mono text-2xl font-bold text-army-gold tracking-wider">DOCTRINE LIBRARY</div>
        <div className="font-mono text-xs text-army-muted mt-1 tracking-wide">
          Army Regulations · Field Manuals · Training Circulars
        </div>
      </div>

      {/* Indexed Documents */}
      <div className="mb-8">
        <div className="font-mono text-[10px] tracking-widest text-army-muted uppercase mb-3">Indexed Documents</div>
        <div className="bg-surface border border-border">
          {loading ? (
            <div className="px-6 py-8 text-center font-mono text-xs text-army-muted">Loading...</div>
          ) : listError ? (
            <div className="px-6 py-8 text-center font-mono text-xs text-danger">{listError}</div>
          ) : docs.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <div className="font-mono text-3xl text-army-muted mb-3">▦</div>
              <div className="font-mono text-xs text-army-muted leading-relaxed">
                No documents indexed.<br />
                Upload your first Army regulation or field manual.
              </div>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-5 py-3 font-mono text-[10px] tracking-widest text-army-muted uppercase">Document</th>
                  <th className="text-right px-5 py-3 font-mono text-[10px] tracking-widest text-army-muted uppercase">Chunks</th>
                  <th className="px-5 py-3 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {docs.map(doc => (
                  <tr key={doc.doc_name} className="border-b border-border last:border-0 hover:bg-[#21262d] transition-colors">
                    <td className="px-5 py-3 font-mono text-sm text-army-text">{doc.doc_name}</td>
                    <td className="px-5 py-3 font-mono text-xs text-army-muted text-right">{doc.chunk_count}</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => handleDelete(doc.doc_name)}
                        className="font-mono text-[10px] tracking-wider text-army-muted hover:text-danger uppercase transition-colors"
                      >
                        DELETE
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Upload Section */}
      <div className="bg-surface border border-border p-6 mb-6">
        <div className="font-mono text-[10px] tracking-widest text-army-muted uppercase mb-4">Upload & Index Document</div>

        <div className="space-y-4">
          <div>
            <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">
              PDF File <span className="text-danger">*</span>
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              disabled={isBusy}
              className="block w-full font-mono text-xs text-army-text file:mr-4 file:py-2 file:px-4 file:border-0 file:font-mono file:text-xs file:tracking-wider file:uppercase file:bg-army-tan file:text-army-text hover:file:bg-[#9e8562] file:cursor-pointer disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">
              Document Name <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              value={docName}
              onChange={e => setDocName(e.target.value)}
              disabled={isBusy}
              placeholder="e.g. AR 600-20.pdf, FM 6-22.pdf"
              className="w-full bg-bg border border-border px-3 py-2.5 font-mono text-sm text-army-text placeholder-army-muted focus:outline-none focus:border-army-tan disabled:opacity-50"
            />
          </div>

          <button
            onClick={handleUpload}
            disabled={!canUpload || isBusy}
            className="w-full border border-army-gold text-army-gold hover:bg-army-gold hover:text-bg disabled:opacity-40 font-mono text-sm tracking-wider uppercase py-3 transition-colors"
          >
            {status === 'uploading' && 'UPLOADING...'}
            {status === 'indexing' && 'INDEXING — PLEASE WAIT...'}
            {(status === 'idle' || status === 'done' || status === 'error') && 'UPLOAD & INDEX'}
          </button>

          {/* Status messages */}
          {status === 'indexing' && (
            <div className="bg-bg border border-army-gold px-4 py-3">
              <div className="font-mono text-xs text-army-gold">
                Indexing {docName} — this may take a minute for large documents.
              </div>
              <div className="mt-1 h-1 bg-border overflow-hidden">
                <div className="h-full bg-army-gold animate-pulse w-full" />
              </div>
            </div>
          )}

          {status === 'done' && (
            <div className="bg-bg border border-border px-4 py-3">
              <div className="font-mono text-xs text-army-text">
                <span className="text-army-gold">Done.</span> Indexed {indexedChunks} chunks into the doctrine library. The SGM will now answer from this document.
              </div>
            </div>
          )}

          {status === 'error' && statusMsg && (
            <div className="bg-bg border border-danger px-4 py-3">
              <div className="font-mono text-xs text-danger">{statusMsg}</div>
            </div>
          )}
        </div>
      </div>

      {/* Tip */}
      <div className="border border-border px-5 py-4">
        <div className="font-mono text-[10px] tracking-widest text-army-muted uppercase mb-1">Tip</div>
        <div className="font-mono text-xs text-army-muted leading-relaxed">
          Name files clearly: <span className="text-army-tan">AR 600-20.pdf</span>, <span className="text-army-tan">FM 6-22.pdf</span> — the SGM cites sources by filename.
          Only text-based PDFs can be indexed; scanned image PDFs will not extract correctly.
        </div>
      </div>
    </div>
  );
}
