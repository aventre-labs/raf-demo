// ChatJimmy — Llama 3.1 8B on Taalas HC1 ASIC (~17k tok/s, essentially instant)
// Uses a pool of CORS proxies to avoid per-proxy rate limits. On 429 the next
// proxy is tried immediately; if all proxies are exhausted, exponential backoff
// is applied before retrying from the beginning of the pool.

const API_URL = 'https://chatjimmy.ai/api/chat';

// CORS proxies that forward POST bodies unchanged.
// corsproxy.io is primary; cors.eu.org is a cors-anywhere clone that handles
// all HTTP methods including POST with arbitrary bodies.
const PROXIES: Array<(u: string) => string> = [
  u => `https://cors.eu.org/${u}`,
  u => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  u => `https://cors-proxy.fringe.zone/${u}`,
  u => `https://thingproxy.freeboard.io/fetch/${u}`,
];

let _proxyIdx = 0;           // rotates on 429
let _backoffMs  = 300;       // resets after a successful call

export interface ChatMessage { role: 'user' | 'assistant'; content: string }
export interface ChatResult { text: string; ttft?: number; tokensPerSec?: number }

// Global LLM call counter — managed by raf-engine
let _callCount = 0;
let _onCallCount: ((n: number) => void) | null = null;

export function resetCallCount() { _callCount = 0; }
export function getCallCount() { return _callCount; }
export function setCallCountCallback(cb: (n: number) => void) { _onCallCount = cb; }

export class LLMCallLimitError extends Error {
  constructor() { super('RAF_CALL_LIMIT: Maximum LLM call limit reached.'); }
}

/** Sleep, then resolve. */
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export async function callLLM(
  messages: ChatMessage[],
  systemPrompt = '',
  topK = 8,
  maxCalls = 5000,
): Promise<ChatResult> {
  _callCount++;
  _onCallCount?.(_callCount);
  if (_callCount > maxCalls) throw new LLMCallLimitError();

  const body = JSON.stringify({
    messages,
    chatOptions: { selectedModel: 'llama3.1-8B', systemPrompt, topK },
    attachment: null,
  });

  const MAX_ATTEMPTS = PROXIES.length * 3;   // up to 3 full rotations
  const MAX_BACKOFF  = 10_000;               // cap at 10 s

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const proxyUrl = PROXIES[_proxyIdx % PROXIES.length](API_URL);
    const t0 = performance.now();

    try {
      const res = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });

      if (res.status === 429) {
        // Rotate proxy immediately and check Retry-After
        _proxyIdx++;
        const retryAfter = res.headers.get('Retry-After');
        const serverWait = retryAfter ? parseInt(retryAfter, 10) * 1000 : 0;

        // If we've gone through all proxies once, use backoff
        if (attempt > 0 && attempt % PROXIES.length === 0) {
          const wait = Math.max(serverWait, _backoffMs);
          console.warn(`[ChatJimmy] All proxies rate-limited. Backing off ${wait}ms…`);
          await sleep(wait);
          _backoffMs = Math.min(_backoffMs * 2, MAX_BACKOFF);
        } else {
          // Try next proxy immediately (or after server-specified wait)
          if (serverWait > 0) await sleep(serverWait);
          console.warn(`[ChatJimmy] 429 on proxy ${attempt % PROXIES.length}. Trying next proxy…`);
        }
        continue;
      }

      if (!res.ok) {
        throw new Error(`ChatJimmy HTTP ${res.status}: ${await res.text().catch(() => '')}`);
      }

      // Successful call — reset backoff
      _backoffMs = 300;

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

    } catch (err) {
      if (err instanceof LLMCallLimitError) throw err;
      // Network error — rotate proxy and wait briefly
      _proxyIdx++;
      if (attempt === MAX_ATTEMPTS - 1) throw err;
      await sleep(Math.min(_backoffMs, 2000));
    }
  }

  throw new Error('ChatJimmy: exceeded maximum retry attempts across all proxies');
}
