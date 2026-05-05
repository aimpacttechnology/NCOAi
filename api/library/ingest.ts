import { createClient } from '@supabase/supabase-js';
import { VoyageAIClient } from 'voyageai';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';

export const config = {
  api: { bodyParser: { sizeLimit: '25mb' } },
  maxDuration: 300,
};

function chunkText(text: string, wordsPerChunk = 600, overlapWords = 80): string[] {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const chunks: string[] = [];
  let start = 0;
  while (start < words.length) {
    const end = Math.min(start + wordsPerChunk, words.length);
    const chunk = words.slice(start, end).join(' ');
    if (chunk.length >= 100) chunks.push(chunk);
    if (end >= words.length) break;
    start = end - overlapWords;
  }
  return chunks;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { fileBase64, docName } = req.body as { fileBase64: string; docName: string };

  if (!fileBase64 || !docName) {
    res.status(400).json({ error: 'fileBase64 and docName are required' });
    return;
  }

  const voyageKey       = process.env.VOYAGE_API_KEY;
  const supabaseUrl     = process.env.SUPABASE_URL;
  const supabaseKey     = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!voyageKey)              { res.status(500).json({ error: 'VOYAGE_API_KEY is not configured on the server' }); return; }
  if (!supabaseUrl || !supabaseKey) { res.status(500).json({ error: 'Missing Supabase credentials on server' }); return; }

  try {
    const buffer = Buffer.from(fileBase64, 'base64');
    const parsed = await pdfParse(buffer);
    const rawText = parsed.text ?? '';

    if (!rawText.trim()) {
      res.status(422).json({ error: 'PDF has no extractable text — it may be a scanned image' });
      return;
    }

    const chunks = chunkText(rawText);
    if (chunks.length === 0) {
      res.status(422).json({ error: 'No usable text chunks extracted from PDF' });
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    await supabase.from('document_chunks').delete().eq('doc_name', docName);

    const voyage = new VoyageAIClient({ apiKey: voyageKey });
    const BATCH = 8;
    const rows: Array<{ doc_name: string; chunk_index: number; content: string; embedding: number[] }> = [];

    for (let i = 0; i < chunks.length; i += BATCH) {
      const batch = chunks.slice(i, i + BATCH);
      const embedRes = await voyage.embed({ input: batch, model: 'voyage-3-lite' });
      const embeddings = (embedRes.data ?? []).map((d: any) => d.embedding as number[]);
      for (let j = 0; j < batch.length; j++) {
        rows.push({ doc_name: docName, chunk_index: i + j, content: batch[j], embedding: embeddings[j] });
      }
    }

    const { error: insertError } = await supabase.from('document_chunks').insert(rows);
    if (insertError) {
      res.status(500).json({ error: `Failed to insert chunks: ${insertError.message}` });
      return;
    }

    res.status(200).json({ success: true, docName, chunks: rows.length });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
