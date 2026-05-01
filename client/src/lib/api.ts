export async function generateCounseling(
  payload: {
    soldier: { name: string; rank: string };
    type: string;
    observations: string;
    plan_of_action: string;
    followup: string;
    nco_id?: string;
    soldier_id?: string;
  },
  onChunk: (text: string) => void
): Promise<void> {
  const res = await fetch('/api/counseling/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(`Server error ${res.status}`);

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response stream');

  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onChunk(decoder.decode(value, { stream: true }));
  }
}

export async function askSGM(
  payload: {
    message: string;
    history: Array<{ role: 'user' | 'assistant'; content: string }>;
  },
  onChunk: (text: string) => void
): Promise<void> {
  const res = await fetch('/api/sgm/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(`Server error ${res.status}`);

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response stream');

  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onChunk(decoder.decode(value, { stream: true }));
  }
}
