// ChatJimmy — Llama 3.1 8B on Taalas HC1 ASIC (~17k tok/s, essentially instant)
// No simulation mode. Live API only — it's free and fast enough for real testing.

const CORS_PROXY = 'https://corsproxy.io/?';
const API_BASE = 'https://chatjimmy.ai';

export interface ChatMessage { role: 'user' | 'assistant'; content: string }
export interface ChatResult { text: string; ttft?: number; tokensPerSec?: number }

// Global LLM call counter — managed by raf-engine
let _callCount = 0;
let _onCallCount: ((n: number) => void) | null = null;

export function resetCallCount() { _callCount = 0; }
export function getCallCount() { return _callCount; }
export function setCallCountCallback(cb: (n: number) => void) { _onCallCount = cb; }

export class LLMCallLimitError extends Error {
  constructor() { super('RAF_CALL_LIMIT_5000: Maximum LLM call limit reached. The problem requires more computational steps than allowed.'); }
}

export async function callLLM(
  messages: ChatMessage[],
  systemPrompt = '',
  topK = 8,
  maxCalls = 5000,
): Promise<ChatResult> {
  _callCount++;
  _onCallCount?.(_callCount);
  if (_callCount > maxCalls) throw new LLMCallLimitError();

  const body = {
    messages,
    chatOptions: { selectedModel: 'llama3.1-8B', systemPrompt, topK },
    attachment: null,
  };

  const url = `${CORS_PROXY}${encodeURIComponent(`${API_BASE}/api/chat`)}`;
  const t0 = performance.now();

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`ChatJimmy HTTP ${res.status}: ${await res.text().catch(() => '')}`);

  const raw = await res.text();
  const ttft = performance.now() - t0;

  const statsIdx = raw.indexOf('<|stats|>');
  const text = statsIdx > -1 ? raw.slice(0, statsIdx).trim() : raw.trim();

  let tokensPerSec: number | undefined;
  if (statsIdx > -1) {
    try {
      const statsStr = raw.slice(statsIdx + 9, raw.indexOf('<|/stats|>'));
      const stats = JSON.parse(statsStr);
      tokensPerSec = stats.decode_rate ?? undefined;
    } catch { /* ignore */ }
  }

  return { text, ttft, tokensPerSec };
}
