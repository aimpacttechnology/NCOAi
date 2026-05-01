/**
 * Ingests Army doctrine PDFs into Supabase with Voyage AI embeddings.
 * Run: npm run ingest
 * Run: npm run ingest:clear   (wipe all chunks and re-index)
 *
 * Reads env from ../server/.env
 * Reads PDFs from ../Books/ (override with DOCS_DIR env var)
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import VoyageAIClient from 'voyageai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(__dirname, '../server/.env') });

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY!;
const DOCS_DIR = process.env.DOCS_DIR || path.join(__dirname, '../Books');

const WORDS_PER_CHUNK = 600;
const OVERLAP_WORDS   = 80;
const EMBED_BATCH     = 8; // voyage rate limit friendly

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !VOYAGE_API_KEY) {
  console.error('Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VOYAGE_API_KEY');
  console.error('Add VOYAGE_API_KEY to server/.env — get a free key at voyageai.com');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const voyage   = new VoyageAIClient({ apiKey: VOYAGE_API_KEY });
const clearMode = process.argv.includes('--clear');

function chunkText(text: string): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  const chunks: string[] = [];
  let i = 0;
  while (i < words.length) {
    const chunk = words.slice(i, i + WORDS_PER_CHUNK).join(' ');
    if (chunk.trim().length > 100) chunks.push(chunk);
    i += WORDS_PER_CHUNK - OVERLAP_WORDS;
  }
  return chunks;
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  const res = await voyage.embed({ input: texts, model: 'voyage-3-lite' });
  return res.data.map((d: { embedding: number[] }) => d.embedding);
}

async function ingestPDF(filePath: string, docName: string): Promise<void> {
  process.stdout.write(`  Parsing...`);
  const pdfParse = (await import('pdf-parse')).default;
  const buffer = fs.readFileSync(filePath);

  let text: string;
  try {
    const parsed = await pdfParse(buffer);
    text = parsed.text;
  } catch (e) {
    console.log(` FAILED (${(e as Error).message})`);
    return;
  }

  const chunks = chunkText(text);
  process.stdout.write(` ${chunks.length} chunks...`);

  for (let b = 0; b < chunks.length; b += EMBED_BATCH) {
    const batch    = chunks.slice(b, b + EMBED_BATCH);
    const vectors  = await embedBatch(batch);

    const rows = batch.map((content, i) => ({
      doc_name:    docName,
      chunk_index: b + i,
      content,
      embedding:   vectors[i],
    }));

    const { error } = await supabase.from('document_chunks').insert(rows);
    if (error) {
      console.error(`\n  Supabase insert error: ${error.message}`);
      return;
    }
    process.stdout.write('.');
  }
  console.log(' done');
}

async function main() {
  if (!fs.existsSync(DOCS_DIR)) {
    console.error(`DOCS_DIR not found: ${DOCS_DIR}`);
    console.error('Set DOCS_DIR in server/.env or ensure Books/ exists next to scripts/');
    process.exit(1);
  }

  if (clearMode) {
    console.log('Clearing all document chunks...');
    const { error } = await supabase.from('document_chunks').delete().neq('id', 0);
    if (error) { console.error(error.message); process.exit(1); }
    console.log('Cleared.\n');
  }

  const allFiles = fs.readdirSync(DOCS_DIR)
    .filter(f => f.toLowerCase().endsWith('.pdf'))
    .sort();

  if (allFiles.length === 0) {
    console.log(`No PDFs found in ${DOCS_DIR}`);
    process.exit(0);
  }

  // Find already-indexed docs
  const { data: existing } = await supabase
    .from('document_chunks')
    .select('doc_name')
    .limit(5000);

  const indexed = new Set((existing ?? []).map((r: { doc_name: string }) => r.doc_name));
  const toProcess = allFiles.filter(f => !indexed.has(f));

  console.log(`Found ${allFiles.length} PDFs — ${indexed.size} already indexed, ${toProcess.length} to process.\n`);

  if (toProcess.length === 0) {
    console.log('All docs already indexed. Run with --clear to re-index.');
    return;
  }

  for (const file of toProcess) {
    process.stdout.write(`[${file}] `);
    await ingestPDF(path.join(DOCS_DIR, file), file);
  }

  const { count } = await supabase
    .from('document_chunks')
    .select('*', { count: 'exact', head: true });

  console.log(`\nTotal chunks in Supabase: ${count}`);
  console.log('Ingestion complete.');
}

main().catch(err => { console.error(err); process.exit(1); });
