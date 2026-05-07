import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '../lib/adminAuth';

export default async function handler(req: any, res: any) {
  if (req.method !== 'DELETE') { res.status(405).json({ error: 'Method not allowed' }); return; }

  if (!await requireAdmin(req, res)) return;

  const { docName } = req.body as { docName: string };
  if (!docName) { res.status(400).json({ error: 'docName is required' }); return; }

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await supabase
      .from('document_chunks')
      .delete()
      .eq('doc_name', docName);

    if (error) { res.status(500).json({ error: error.message }); return; }

    await supabase.storage.from('doctrine-docs').remove([docName]);

    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
