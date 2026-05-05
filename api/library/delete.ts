import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'DELETE') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { docName } = req.body as { docName: string };

  if (!docName) {
    res.status(400).json({ error: 'docName is required' });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    res.status(500).json({ error: 'Server configuration error: missing Supabase credentials' });
    return;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Delete all document chunks for this docName
    const { error: deleteChunksError } = await supabase
      .from('document_chunks')
      .delete()
      .eq('doc_name', docName);

    if (deleteChunksError) {
      res.status(500).json({ error: `Failed to delete chunks: ${deleteChunksError.message}` });
      return;
    }

    // Attempt to remove the file from Storage (best-effort, don't fail if missing)
    await supabase.storage.from('doctrine-docs').remove([docName]);

    res.status(200).json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
}
