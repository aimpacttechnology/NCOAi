import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

export const config = { maxDuration: 60 };

const SGM_BASE = `You are a Sergeant Major (SGM) with 25 years of U.S. Army service.
You are an expert in Army doctrine, regulations, and NCO leadership.

You have been provided with a searchable doctrine library of Army regulations and field manuals. When relevant passages from that library are included below your instructions, use them as your PRIMARY source — quote them directly and cite the document name. If no passages are provided, answer from your training knowledge and say so.

When answering questions:
- Be direct and practical — no fluff
- Cite the source document by name whenever you reference doctrine
- Apply doctrine to the specific scenario the NCO describes
- If unsure, say so and recommend they consult their senior NCO or JAG

You help NCOs make better decisions and never guess at regulations.`;

async function getDocContext(message: string): Promise<{ context: string; sources: string[]; debug: string }> {
  const voyageKey       = process.env.VOYAGE_API_KEY;
  const supabaseUrl     = process.env.SUPABASE_URL;
  const supabaseKey     = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!voyageKey)                    return { context: '', sources: [], debug: 'VOYAGE_API_KEY missing' };
  if (!supabaseUrl || !supabaseKey)  return { context: '', sources: [], debug: 'Supabase credentials missing' };

  try {
    const embedRes = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${voyageKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: [message], model: 'voyage-3-lite' }),
    });

    if (!embedRes.ok) {
      const txt = await embedRes.text();
      return { context: '', sources: [], debug: `VoyageAI ${embedRes.status}: ${txt}` };
    }

    const embedJson = await embedRes.json() as { data: Array<{ embedding: number[] }> };
    const queryEmbedding = embedJson.data?.[0]?.embedding;
    if (!queryEmbedding) return { context: '', sources: [], debug: 'No embedding returned from VoyageAI' };

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase.rpc('search_doc_chunks', {
      query_embedding: queryEmbedding,
      match_count: 5,
      min_similarity: 0.1,
    });

    if (error)              return { context: '', sources: [], debug: `Supabase RPC error: ${error.message}` };
    if (!data?.length)      return { context: '', sources: [], debug: 'No chunks found above similarity threshold' };

    const sources: string[] = [...new Set<string>(data.map((r: any) => r.doc_name))];
    const context = data.map((r: any) => `[${r.doc_name}]\n${r.content}`).join('\n\n---\n\n');

    return { context, sources, debug: '' };
  } catch (err) {
    return { context: '', sources: [], debug: `Exception: ${err instanceof Error ? err.message : String(err)}` };
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { message, history = [] } = req.body as {
    message: string;
    history: Array<{ role: 'user' | 'assistant'; content: string }>;
  };

  if (!message?.trim()) { res.status(400).json({ error: 'Message required' }); return; }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    const { context, sources, debug } = await getDocContext(message);

    let systemPrompt = SGM_BASE;
    if (context) {
      systemPrompt += `\n\nThe following excerpts are from the unit's indexed doctrine library. Use them to answer accurately and cite the source document:\n\n${context}`;
    }

    if (sources.length > 0) {
      res.write(`[Searching doctrine: ${sources.join(', ')}]\n\n`);
    } else {
      res.write(`[RAG: ${debug || 'no matches'}]\n\n`);
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [...history, { role: 'user', content: message }],
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        res.write(chunk.delta.text);
      }
    }
    res.end();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!res.headersSent) res.status(500).json({ error: msg });
    else res.end();
  }
}
