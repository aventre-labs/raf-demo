const CORS_PROXY = 'https://corsproxy.io/?';
const API_BASE = 'https://chatjimmy.ai';

export interface ChatMessage { role: 'user' | 'assistant'; content: string }

export interface ChatResult { text: string; simulated: boolean }

let _simMode = false;
export function setSimulationMode(v: boolean) { _simMode = v; }

export async function callLLM(messages: ChatMessage[], systemPrompt = '', topK = 8): Promise<ChatResult> {
  if (_simMode) return simulate(messages, systemPrompt);

  const body = {
    messages,
    chatOptions: { selectedModel: 'llama3.1-8B', systemPrompt, topK },
    attachment: null,
  };

  try {
    const url = `${CORS_PROXY}${encodeURIComponent(`${API_BASE}/api/chat`)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.text();
    const statsIdx = raw.indexOf('<|stats|>');
    const text = statsIdx > -1 ? raw.slice(0, statsIdx).trim() : raw.trim();
    return { text, simulated: false };
  } catch {
    return simulate(messages, systemPrompt);
  }
}

async function simulate(messages: ChatMessage[], sys: string): Promise<ChatResult> {
  await new Promise(r => setTimeout(r, 60 + Math.random() * 100));
  const last = messages[messages.length - 1]?.content ?? '';

  let text = '';
  if (/base.?case|recursive/i.test(sys)) {
    text = last.length < 150 ? 'Base Case' : 'Base Case';
  } else if (/design|approach/i.test(sys)) {
    text = JSON.stringify({ approach: 'Direct step-by-step computation.', key_operations: ['parse', 'compute', 'verify'], expected_output: 'numeric answer' });
  } else if (/vote|best.*index|index.*best/i.test(sys)) {
    text = '0';
  } else if (/decompose|plan|sub.?task/i.test(sys)) {
    text = JSON.stringify([
      { name: 'step-1', context: 'First part: ' + last.slice(0, 120), dependsOn: [] },
      { name: 'step-2', context: 'Second part combining results: ' + last.slice(0, 80), dependsOn: ['step-1'] }
    ]);
  } else if (/analys|evaluat/i.test(sys)) {
    text = JSON.stringify({ success: true, info: 'Task completed successfully with correct reasoning.' });
  } else if (/merge|concat|union/i.test(sys)) {
    text = JSON.stringify({ merged_plans: [[{ name: 'step-1', context: last.slice(0, 100), dependsOn: [] }, { name: 'step-2', context: last.slice(0, 80), dependsOn: ['step-1'] }]] });
  } else {
    const numMatch = last.match(/\b(\d[\d,]*\.?\d*)\b/g);
    const nums = numMatch ? numMatch.map(n => parseFloat(n.replace(/,/g, ''))).filter(n => !isNaN(n)) : [];
    const answer = nums.length > 0 ? String(nums[nums.length - 1]) : '42';
    text = `Step 1: Identified the key quantities.\nStep 2: Applied the computation.\nStep 3: Verified correctness.\n\nFinal answer: ${answer}\n#### ${answer}`;
  }

  return { text, simulated: true };
}
