import { createClient } from '@supabase/supabase-js';
import { VoyageAIClient } from 'voyageai';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';

export const config = { maxDuration: 300 };

function chunkText(text: string, wordsPerChunk = 600, overlapWords = 80): string[] {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const chunks: string[] = [];
  let start = 0;

  while (start < words.length) {
    const end = Math.min(start + wordsPerChunk, words.length);
    const chunk = words.slice(start, end).join(' ');
    if (chunk.length >= 100) {
      chunks.push(chunk);
    }
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

  const { storagePath, docName } = req.body as { storagePath: string; docName: string };

  if (!storagePath || !docName) {
    res.status(400).json({ error: 'storagePath and docName are required' });
    return;
  }

  const voyageKey = process.env.VOYAGE_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!voyageKey) {
    res.status(500).json({ error: 'VOYAGE_API_KEY is not configured on the server' });
    return;
  }
  if (!supabaseUrl || !supabaseServiceKey) {
    res.status(500).json({ error: 'Server configuration error: missing Supabase credentials' });
    return;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Download file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('doctrine-docs')
      .download(storagePath);

    if (downloadError || !fileData) {
      res.status(500).json({ error: `Failed to download file: ${downloadError?.message ?? 'Unknown error'}` });
      return;
    }

    // Convert Blob to Buffer for pdf-parse
    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse PDF
    const parsed = await pdfParse(buffer);
    const rawText = parsed.text ?? '';

    if (!rawText.trim()) {
      res.status(422).json({ error: 'PDF appears to have no extractable text (may be a scanned image)' });
      return;
    }

    // Chunk the text
    const chunks = chunkText(rawText, 600, 80);

    if (chunks.length === 0) {
      res.status(422).json({ error: 'No usable text chunks extracted from PDF' });
      return;
    }

    // Delete existing chunks for this docName
    const { error: deleteError } = await supabase
      .from('document_chunks')
      .delete()
      .eq('doc_name', docName);

    if (deleteError) {
      res.status(500).json({ error: `Failed to clear existing chunks: ${deleteError.message}` });
      return;
    }

    // Embed in batches of 8 via VoyageAI
    const voyage = new VoyageAIClient({ apiKey: voyageKey });
    const BATCH_SIZE = 8;
    const rows: Array<{ doc_name: string; chunk_index: number; content: string; embedding: number[] }> = [];

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const embedRes = await voyage.embed({
        input: batch,
        model: 'voyage-3-lite',
      });

      const embeddings = (embedRes.data ?? []).map((item: any) => item.embedding as number[]);

      for (let j = 0; j < batch.length; j++) {
        rows.push({
          doc_name: docName,
          chunk_index: i + j,
          content: batch[j],
          embedding: embeddings[j],
        });
      }
    }

    // Insert all rows
    const { error: insertError } = await supabase
      .from('document_chunks')
      .insert(rows);

    if (insertError) {
      res.status(500).json({ error: `Failed to insert chunks: ${insertError.message}` });
      return;
    }

    res.status(200).json({ success: true, docName, chunks: rows.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
}
