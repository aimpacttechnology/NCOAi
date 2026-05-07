import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '../lib/adminAuth';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }

  if (!await requireAdmin(req, res)) return;

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const { data, error } = await supabase
      .from('document_chunks')
      .select('doc_name');

    if (error) { res.status(500).json({ error: error.message }); return; }

    const counts: Record<string, number> = {};
    for (const row of data ?? []) {
      counts[row.doc_name] = (counts[row.doc_name] || 0) + 1;
    }

    const docs = Object.entries(counts)
      .map(([doc_name, chunk_count]) => ({ doc_name, chunk_count }))
      .sort((a, b) => a.doc_name.localeCompare(b.doc_name));

    res.status(200).json({ docs });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
