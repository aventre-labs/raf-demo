import { useState, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Zap, Layers, Network, BarChart3 } from 'lucide-react';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './components/ui/tabs';
import { Switch } from './components/ui/switch';
import { ScrollArea } from './components/ui/scroll-area';
import { Separator } from './components/ui/separator';
import { ExecutionGraph } from './components/ExecutionGraph';
import { ParamPanel } from './components/ParamPanel';
import { PROBLEMS, CATEGORIES } from './data/benchmarks';
import { runRAF, type RafResult } from './engine/raf-engine';
import type { GraphNode, GraphEdge, GraphMode, ExecutionEvent, RAFParams } from './engine/types';
import { DEFAULT_PARAMS } from './engine/types';

interface Session {
  id: string; name: string; ts: number; problem: string;
  result: RafResult | null; nodes: GraphNode[]; links: GraphEdge[];
}

function uid() { return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }
function short(s: string, n = 36) { return s.length > n ? s.slice(0, n) + '…' : s; }
function hhmm(ts: number) { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }

const LS_KEY = 'raf-demo-sessions-v2';

export default function App() {
  const [sessions, setSessions] = useState<Session[]>(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]'); } catch { return []; }
  });
  const [activeId, setActiveId] = useState(() => {
    try { const s = JSON.parse(localStorage.getItem(LS_KEY) ?? '[]'); return (s[0] as Session | undefined)?.id ?? ''; } catch { return ''; }
  });
  const [params, setParams] = useState<RAFParams>({ ...DEFAULT_PARAMS });
  const [running, setRunning] = useState(false);
  const [graphMode, setGraphMode] = useState<GraphMode>('full');
  const [customPrompt, setCustomPrompt] = useState('');
  const [selCat, setSelCat] = useState(CATEGORIES[0]);
  const [sidebarView, setSidebarView] = useState<'sessions' | 'params'>('sessions');

  const nodesRef = useRef<GraphNode[]>([]);
  const linksRef = useRef<GraphEdge[]>([]);
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([]);
  const [graphLinks, setGraphLinks] = useState<GraphEdge[]>([]);

  const graphRef = useRef<HTMLDivElement>(null);
  const [gSize, setGSize] = useState({ w: 600, h: 700 });
  useEffect(() => {
    const upd = () => {
      if (graphRef.current) {
        const r = graphRef.current.getBoundingClientRect();
        if (r.width > 0) setGSize({ w: r.width, h: r.height });
      }
    };
    upd();
    const obs = new ResizeObserver(upd);
    if (graphRef.current) obs.observe(graphRef.current);
    return () => obs.disconnect();
  }, []);

  const persist = useCallback((next: Session[]) => {
    setSessions(next);
    try { localStorage.setItem(LS_KEY, JSON.stringify(next.slice(0, 20))); } catch { /* ignore */ }
  }, []);

  const activeSession = sessions.find(s => s.id === activeId) ?? null;

  const handleEvent = useCallback((ev: ExecutionEvent, sid: string) => {
    const mkId = (id: string) => `${sid}::${id}`;

    if (ev.type === 'raf_node_start') {
      const node: GraphNode = {
        id: mkId(ev.rafNodeId), type: 'raf-node',
        label: ev.label === 'root' ? 'Problem' : ev.label,
        detail: `RafNode "${ev.label}" — depth ${ev.depth}`,
        active: true, rafNodeId: ev.rafNodeId,
      };
      nodesRef.current = [...nodesRef.current, node];
      if (ev.parentRafNodeId) {
        linksRef.current = [...linksRef.current, {
          id: `${mkId(ev.parentRafNodeId)}->${mkId(ev.rafNodeId)}`,
          source: mkId(ev.parentRafNodeId), target: mkId(ev.rafNodeId), edgeType: 'parallel',
        }];
      }
      setGraphNodes([...nodesRef.current]);
      setGraphLinks([...linksRef.current]);
      return;
    }

    if (ev.type === 'raf_node_done') {
      nodesRef.current = nodesRef.current.map(n =>
        n.id === mkId(ev.rafNodeId) ? { ...n, active: false, success: ev.success } : n
      );
      setGraphNodes([...nodesRef.current]);
      return;
    }

    if (ev.type === 'node_start') {
      const node: GraphNode = {
        id: mkId(ev.nodeId), type: ev.nodeType,
        label: ev.label, detail: `${ev.nodeType}: ${ev.label}`,
        active: true, rafNodeId: ev.rafNodeId,
      };
      nodesRef.current = [...nodesRef.current, node];
      if (ev.parentId) {
        linksRef.current = [...linksRef.current, {
          id: `${mkId(ev.parentId)}->${mkId(ev.nodeId)}`,
          source: mkId(ev.parentId), target: mkId(ev.nodeId),
          edgeType: ev.edgeType ?? 'flow',
        }];
      }
      setGraphNodes([...nodesRef.current]);
      setGraphLinks([...linksRef.current]);
      return;
    }

    if (ev.type === 'node_done') {
      nodesRef.current = nodesRef.current.map(n =>
        n.id === mkId(ev.nodeId) ? { ...n, active: false, success: ev.success } : n
      );
      setGraphNodes([...nodesRef.current]);
    }
  }, []);

  const launchRun = useCallback(async (problem: string) => {
    if (!problem.trim() || running) return;
    const id = uid();
    const session: Session = { id, name: short(problem, 32), ts: Date.now(), problem, result: null, nodes: [], links: [] };

    nodesRef.current = [];
    linksRef.current = [];
    setGraphNodes([]);
    setGraphLinks([]);
    setActiveId(id);
    persist([session, ...sessions]);
    setRunning(true);

    try {
      const result = await runRAF(problem, params, ev => handleEvent(ev, id));
      const finalNodes = [...nodesRef.current];
      const finalLinks = [...linksRef.current];
      setSessions(prev => {
        const next = prev.map(s => s.id === id ? { ...s, result, nodes: finalNodes, links: finalLinks } : s);
        try { localStorage.setItem(LS_KEY, JSON.stringify(next.slice(0, 20))); } catch { /* ignore */ }
        return next;
      });
    } catch (e) {
      console.error('RAF error:', e);
    }
    setRunning(false);
  }, [running, sessions, params, handleEvent, persist]);

  // Restore graph when switching sessions
  useEffect(() => {
    if (!activeSession) { setGraphNodes([]); setGraphLinks([]); return; }
    nodesRef.current = activeSession.nodes;
    linksRef.current = activeSession.links;
    setGraphNodes([...activeSession.nodes]);
    setGraphLinks([...activeSession.links]);
  }, [activeId]); // eslint-disable-line

  const legend = [
    { c: '#00e5ff', l: 'RafNode' }, { c: '#e040fb', l: 'Jury' },
    { c: '#ffeb3b', l: 'Consortium' }, { c: '#69ff47', l: 'Agent' }, { c: '#ff9100', l: 'Analysis' },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground text-sm">

      {/* ── SIDEBAR ─────────────────────────────────────────────── */}
      <div className="flex flex-col w-60 border-r border-border bg-card shrink-0">
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <span className="font-semibold">RAF Demo</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Recursive Agent Framework</p>
        </div>

        <div className="flex border-b border-border text-xs">
          {(['sessions', 'params'] as const).map(v => (
            <button key={v} onClick={() => setSidebarView(v)}
              className={`flex-1 py-2 capitalize font-medium transition-colors ${sidebarView === v ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}>
              {v}
            </button>
          ))}
        </div>

        {sidebarView === 'sessions' ? (
          <>
            <div className="px-3 py-2 border-b border-border">
              <Button size="sm" className="w-full gap-1 text-xs" disabled={running}
                onClick={() => { setCustomPrompt(''); setActiveId(''); setGraphNodes([]); setGraphLinks([]); }}>
                <Plus className="h-3.5 w-3.5" /> New Session
              </Button>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {sessions.length === 0 && (
                  <p className="text-xs text-center text-muted-foreground py-8 px-4">Run a problem to create a session</p>
                )}
                {sessions.map(s => (
                  <button key={s.id} onClick={() => setActiveId(s.id)}
                    className={`w-full text-left px-3 py-2 rounded-md transition-colors ${s.id === activeId ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/40 text-muted-foreground'}`}>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${s.result?.success ? 'bg-green-500' : s.result ? 'bg-red-500' : 'bg-muted-foreground'}`} />
                      <span className="text-xs font-medium text-foreground truncate">{s.name}</span>
                      <span className="ml-auto text-[10px] text-muted-foreground shrink-0">{hhmm(s.ts)}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground pl-3">{s.nodes.length} nodes</div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </>
        ) : (
          <ScrollArea className="flex-1 p-3">
            <ParamPanel params={params} onChange={setParams} disabled={running} />
          </ScrollArea>
        )}
      </div>

      {/* ── CENTER ──────────────────────────────────────────────── */}
      <div className="flex flex-col w-96 border-r border-border shrink-0">
        <div className="px-4 py-3 border-b border-border">
          <Tabs defaultValue="custom">
            <TabsList className="w-full">
              <TabsTrigger value="custom" className="flex-1 text-xs">Custom</TabsTrigger>
              <TabsTrigger value="benchmarks" className="flex-1 text-xs">Benchmarks</TabsTrigger>
            </TabsList>

            <TabsContent value="custom" className="mt-3 space-y-2">
              <textarea value={customPrompt} onChange={e => setCustomPrompt(e.target.value)}
                placeholder="Enter any problem for RAF to solve…"
                className="w-full h-28 bg-background border border-border rounded-md p-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground font-mono"
                disabled={running} />
              <Button size="sm" className="w-full gap-1.5" disabled={running || !customPrompt.trim()}
                onClick={() => launchRun(customPrompt)}>
                {running ? <><span className="animate-spin">⟳</span> Running…</> : <><Zap className="h-3.5 w-3.5" /> Run RAF Pipeline</>}
              </Button>
            </TabsContent>

            <TabsContent value="benchmarks" className="mt-3">
              <div className="flex flex-wrap gap-1 mb-2">
                {CATEGORIES.map(c => (
                  <button key={c} onClick={() => setSelCat(c)}
                    className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${selCat === c ? 'border-primary text-primary bg-primary/10' : 'border-border text-muted-foreground hover:border-primary/50'}`}>
                    {c}
                  </button>
                ))}
              </div>
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {PROBLEMS.filter(p => p.category === selCat).map(p => (
                  <button key={p.id} disabled={running} onClick={() => launchRun(p.q)}
                    className="w-full text-left px-3 py-2 rounded-md border border-border hover:border-primary/50 hover:bg-accent/30 transition-colors text-xs disabled:opacity-40">
                    <div className="flex items-center justify-between mb-0.5">
                      <Badge variant="outline" className="text-[10px] px-1 py-0">{p.id}</Badge>
                      <span className="text-muted-foreground text-[10px]">→ {p.expected}</span>
                    </div>
                    <p className="text-muted-foreground line-clamp-2">{p.q}</p>
                  </button>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Results */}
        <ScrollArea className="flex-1 px-4 py-3">
          {!activeSession && !running && (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-center">
              <BarChart3 className="h-7 w-7 mb-2 opacity-30" />
              <p className="text-xs">Run a problem to see results</p>
            </div>
          )}
          {running && !activeSession?.result && (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-10 rounded-md bg-muted animate-pulse" style={{ animationDelay: `${i * 0.12}s` }} />
              ))}
              <p className="text-xs text-center text-muted-foreground mt-2">
                RAF pipeline running… {graphNodes.length} LLM calls so far
              </p>
            </div>
          )}
          {activeSession?.result && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
              <div className="rounded-md border border-border bg-card/50 p-3 text-xs">
                <div className="text-muted-foreground mb-1">Problem</div>
                <p className="text-foreground">{activeSession.problem}</p>
              </div>
              <div className={`rounded-md border p-3 ${activeSession.result.success ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs font-semibold ${activeSession.result.success ? 'text-green-400' : 'text-red-400'}`}>
                    {activeSession.result.success ? '✓ Complete' : '✗ Failed'}
                  </span>
                  <Badge variant="outline" className="text-[10px]">{activeSession.nodes.length} LLM calls</Badge>
                </div>
                {activeSession.result.answer && (
                  <div className="font-mono text-lg font-bold text-foreground leading-tight">
                    {activeSession.result.answer.slice(0, 200)}
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-2">{activeSession.result.summary.slice(0, 300)}</p>
              </div>
              {Object.keys(activeSession.result.children).length > 0 && (
                <div className="rounded-md border border-border p-3 text-xs space-y-1.5">
                  <div className="text-muted-foreground mb-1">Sub-tasks</div>
                  {Object.entries(activeSession.result.children).map(([n, r]) => (
                    <div key={n} className="flex items-start gap-2">
                      <span className={`mt-1 h-1.5 w-1.5 rounded-full shrink-0 ${r.success ? 'bg-green-500' : 'bg-red-500'}`} />
                      <div>
                        <span className="font-medium text-foreground">{n}</span>
                        {r.answer && <span className="text-primary ml-1">→ {r.answer.slice(0, 60)}</span>}
                        <p className="text-muted-foreground">{r.summary.slice(0, 100)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </ScrollArea>
      </div>

      {/* ── D3 GRAPH ────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">Execution Graph</span>
            <Badge variant="outline" className="text-xs">{graphNodes.length} nodes</Badge>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden xl:flex items-center gap-3">
              {legend.map(l => (
                <div key={l.l} className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full" style={{ background: l.c }} />
                  <span className="text-[10px] text-muted-foreground">{l.l}</span>
                </div>
              ))}
            </div>
            <Separator orientation="vertical" className="h-5" />
            <div className="flex items-center gap-2">
              <Layers className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{graphMode === 'full' ? 'Full Detail' : 'Simplified'}</span>
              <Switch checked={graphMode === 'simplified'} onCheckedChange={v => setGraphMode(v ? 'simplified' : 'full')} />
            </div>
          </div>
        </div>
        <div ref={graphRef} className="flex-1 min-h-0">
          <ExecutionGraph nodes={graphNodes} links={graphLinks} mode={graphMode} width={gSize.w} height={gSize.h} />
        </div>
      </div>
    </div>
  );
}
