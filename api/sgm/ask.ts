import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { VoyageAIClient } from 'voyageai';

export const config = { maxDuration: 60 };

const SGM_BASE = `You are a Sergeant Major (SGM) with 25 years of U.S. Army service.
You are an expert in Army doctrine, regulations, and NCO leadership.

When answering questions:
- Be direct and practical — no fluff
- Cite the relevant regulation or field manual by name (e.g., AR 600-20, FM 6-22, ADP 6-22)
- Apply doctrine to the specific scenario the NCO describes
- If unsure, say so and recommend they consult their senior NCO or JAG

You help NCOs make better decisions and never guess at regulations.`;

async function getDocContext(message: string): Promise<{ context: string; sources: string[] }> {
  const voyageKey = process.env.VOYAGE_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!voyageKey || !supabaseUrl || !supabaseServiceKey) {
    return { context: '', sources: [] };
  }

  try {
    const voyage = new VoyageAIClient({ apiKey: voyageKey });
    const embedRes = await voyage.embed({
      input: message,
      model: 'voyage-3-lite',
    });

    const queryEmbedding = (embedRes.data?.[0] as any)?.embedding;
    if (!queryEmbedding) return { context: '', sources: [] };

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data, error } = await supabase.rpc('search_doc_chunks', {
      query_embedding: queryEmbedding,
      match_count: 5,
      min_similarity: 0.3,
    });

    if (error || !data || data.length === 0) return { context: '', sources: [] };

    const sources: string[] = [...new Set<string>(data.map((row: any) => row.doc_name))];
    const context = data
      .map((row: any) => `[${row.doc_name}]\n${row.content}`)
      .join('\n\n---\n\n');

    return { context, sources };
  } catch {
    return { context: '', sources: [] };
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { message, history = [] } = req.body as {
    message: string;
    history: Array<{ role: 'user' | 'assistant'; content: string }>;
  };

  if (!message?.trim()) {
    res.status(400).json({ error: 'Message required' });
    return;
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    const { context, sources } = await getDocContext(message);

    let systemPrompt = SGM_BASE;
    if (context) {
      systemPrompt += `\n\nThe following excerpts are from the unit's indexed doctrine library. Use them to answer accurately and cite the source document:\n\n${context}`;
    }

    if (sources.length > 0) {
      res.write(`[Searching doctrine: ${sources.join(', ')}]\n\n`);
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
    if (!res.headersSent) {
      res.status(500).json({ error: msg });
    } else {
      res.end();
    }
  }
}
