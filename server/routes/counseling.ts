import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { anthropic, MODEL } from '../lib/claude';

const router = Router();

router.post('/generate', async (req: Request, res: Response) => {
  const { soldier, type, observations, plan_of_action, followup, nco_id, soldier_id } = req.body;

  if (!soldier?.name || !soldier?.rank || !type || !observations || !plan_of_action) {
    res.status(400).json({ error: 'Missing required fields: soldier, type, observations, plan_of_action' });
    return;
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');

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

  let fullOutput = '';

  try {
    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        fullOutput += chunk.delta.text;
        res.write(chunk.delta.text);
      }
    }

    if (nco_id && soldier_id && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
      await supabase.from('counselings').insert({
        soldier_id,
        nco_id,
        type,
        raw_input: { soldier, observations, plan_of_action, followup },
        generated_output: fullOutput,
      });
    }

    res.end();
  } catch (error) {
    console.error('Counseling generation error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate counseling' });
    } else {
      res.end();
    }
  }
});

export default router;
