import { runRAF } from '../engine/raf-engine';
import { DEFAULT_PARAMS } from '../engine/types';
import type { RAFParams, ExecutionEvent } from '../engine/types';

// Store the original fetch before we wrap it
const originalFetch = window.fetch;

window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  
  if (urlStr.includes('/api/raf')) {
    // Parse headers to params
    const headers = new Headers(init?.headers);
    const params: RAFParams = { ...DEFAULT_PARAMS };
    
    // Override params from headers
    if (headers.has('x-raf-base-case-jury-size')) params.baseCaseJurySize = parseInt(headers.get('x-raf-base-case-jury-size')!);
    if (headers.has('x-raf-error-finder-jury-size')) params.errorFinderJurySize = parseInt(headers.get('x-raf-error-finder-jury-size')!);

    let problem = '';
    let expected = undefined;
    if (init?.body && typeof init.body === 'string') {
      try {
        const bodyObj = JSON.parse(init.body);
        problem = bodyObj.problem || '';
        expected = bodyObj.expected;
      } catch {
        problem = init.body;
      }
    }

    if (!problem) {
      return new Response(JSON.stringify({ error: 'Problem statement required in body' }), { status: 400 });
    }

    const stream = new ReadableStream({
      start(controller) {
        runRAF(problem, params, (ev: ExecutionEvent) => {
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(ev)}\n\n`));
        }, expected).then(result => {
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'DONE', result })}\n\n`));
          controller.close();
        }).catch(err => {
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'ERROR', error: err.message })}\n\n`));
          controller.close();
        });
      }
    });

    return new Response(stream, { 
      status: 200,
      headers: { 
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      } 
    });
  }

  // Fallback to real fetch for everything else
  return originalFetch(input, init);
};

export function initMockServer() {
  console.log('[RAF API] Headless API active at /api/raf');
  console.log('You can test it headlessly via: fetch("/api/raf", { method: "POST", headers: { "x-raf-jury-size": "3" }, body: JSON.stringify({ problem: "test" }) })');
}
