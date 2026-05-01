import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { soldier, type, observations, plan_of_action, followup, nco_id, soldier_id } =
    await req.json() as {
      soldier: { name: string; rank: string };
      type: string;
      observations: string;
      plan_of_action: string;
      followup?: string;
      nco_id?: string;
      soldier_id?: string;
    };

  if (!soldier?.name || !type || !observations || !plan_of_action) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const prompt = `You are a Master Sergeant with 20 years of leadership experience.
Generate a professional DA Form 4856 counseling statement based on the following inputs.

Soldier: ${soldier.name}, ${soldier.rank}
Counseling Type: ${type}
Observations: ${observations}
Plan of Action: ${plan_of_action}
Follow-up: ${followup || 'None specified'}

Output the counseling in this structure:
- Purpose of Counseling
- Key Points of Discussion (factual, FM 6-22 grounded)
- Plan of Action
- Leader Responsibilities
- Session Closing

Use professional Army language. Reference applicable doctrine (FM 6-22, AR 600-20) where relevant.`;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const encoder = new TextEncoder();
  const chunks: string[] = [];

  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = anthropic.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 2048,
          messages: [{ role: 'user', content: prompt }],
        });

        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            chunks.push(chunk.delta.text);
            controller.enqueue(encoder.encode(chunk.delta.text));
          }
        }

        // Save to Supabase after full generation
        if (nco_id && soldier_id && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
          const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
          await supabase.from('counselings').insert({
            soldier_id,
            nco_id,
            type,
            raw_input: { soldier, observations, plan_of_action, followup },
            generated_output: chunks.join(''),
          });
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
