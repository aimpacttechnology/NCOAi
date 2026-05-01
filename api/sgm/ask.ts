import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import VoyageAIClient from 'voyageai';

export const runtime = 'edge';

const SGM_BASE = `You are a Sergeant Major (SGM) with 25 years of U.S. Army service.
You are an expert in Army doctrine, regulations, and NCO leadership.

When answering questions:
- Be direct and practical — no fluff
- Cite the relevant regulation or field manual by name (e.g., AR 600-20, FM 6-22, ADP 6-22)
- Apply doctrine to the specific scenario the NCO describes
- If unsure, say so and recommend they consult their senior NCO or JAG

You help NCOs make better decisions and never guess at regulations.`;

interface DocChunk {
  doc_name: string;
  content: string;
  similarity: number;
}

async function getDocContext(message: string): Promise<{ context: string; sources: string[] }> {
  const voyageKey  = process.env.VOYAGE_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!voyageKey || !supabaseUrl || !supabaseKey) {
    return { context: '', sources: [] };
  }

  try {
    const voyage   = new VoyageAIClient({ apiKey: voyageKey });
    const embedRes = await voyage.embed({ input: [message], model: 'voyage-3-lite' });
    const embedding = embedRes.data[0].embedding;

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: chunks } = await supabase.rpc('search_doc_chunks', {
      query_embedding: embedding,
      match_count: 5,
      min_similarity: 0.3,
    });

    if (!chunks || chunks.length === 0) return { context: '', sources: [] };

    const sources = [...new Set((chunks as DocChunk[]).map(c => c.doc_name))] as string[];
    const context = (chunks as DocChunk[])
      .map((c, i) => `[Source ${i + 1} — ${c.doc_name}]\n${c.content}`)
      .join('\n\n');

    return { context, sources };
  } catch {
    return { context: '', sources: [] };
  }
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { message, history = [] } = await req.json() as {
    message: string;
    history: Array<{ role: 'user' | 'assistant'; content: string }>;
  };

  if (!message?.trim()) {
    return new Response(JSON.stringify({ error: 'Message required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Run RAG lookup and Claude stream setup in parallel
  const [{ context, sources }, anthropic] = await Promise.all([
    getDocContext(message),
    Promise.resolve(new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })),
  ]);

  let systemPrompt = SGM_BASE;
  if (context) {
    systemPrompt += `\n\n---\nRELEVANT DOCTRINE FROM YOUR INDEXED LIBRARY:\n\n${context}\n\n---\nGround your response in these passages where applicable. Reference the source document by name when citing them.`;
  }

  const encoder = new TextEncoder();

  // Stream sources header first if RAG found results
  const preamble = sources.length > 0
    ? `[Searching: ${sources.slice(0, 3).join(', ')}${sources.length > 3 ? '...' : ''}]\n\n`
    : '';

  const readable = new ReadableStream({
    async start(controller) {
      try {
        if (preamble) {
          controller.enqueue(encoder.encode(preamble));
        }

        const stream = anthropic.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: systemPrompt,
          messages: [
            ...history,
            { role: 'user', content: message },
          ],
        });

        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(chunk.delta.text));
          }
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  });
}
