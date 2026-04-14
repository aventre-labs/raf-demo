import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Zap, Layers, Network, BarChart3, AlertCircle } from 'lucide-react';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { Switch } from './components/ui/switch';
import { ScrollArea } from './components/ui/scroll-area';
import { Separator } from './components/ui/separator';
import { ExecutionGraph } from './components/ExecutionGraph';
import { ParamPanel } from './components/ParamPanel';
import { PROBLEMS, CATEGORIES, BENCHMARKS_META } from './data/benchmarks';
import { runRAF, type RafResult } from './engine/raf-engine';
import { LLMCallLimitError, getCallCount } from './services/chatjimmy';
import type { GraphNode, GraphEdge, GraphMode, ExecutionEvent, RAFParams } from './engine/types';
import { DEFAULT_PARAMS, MAX_LLM_CALLS } from './engine/types';

interface Session {
  id: string;
  name: string;
  ts: number;
  problem: string;
  result: RafResult | null;
  nodes: GraphNode[];
  links: GraphEdge[];
  callCount: number;
  error?: string;
  jsonStats?: { attempts: number; successes: number };
}

function uid() { return `${Date.now()}-${Math.random().toString(36)?.slice(2, 7)}`; }
function short(s: string, n = 34) { const str = String(s || ''); return str.length > n ? str?.slice(0, n) + '…' : str; }
function hhmm(ts: number) { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }

const LS_KEY = 'raf-demo-sessions-v3';

export default function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string>('');

  const [params, setParams] = useState<RAFParams>({ ...DEFAULT_PARAMS });
  const [running, setRunning] = useState(false);
  const [graphMode, setGraphMode] = useState<GraphMode>('simplified');

  // Controlled tab state — this is the fix for the benchmark crash
  const [activeTab, setActiveTab] = useState<'custom' | 'benchmarks'>('custom');
  const [customPrompt, setCustomPrompt] = useState('');
  const [selCat, setSelCat] = useState<string>(CATEGORIES[0] ?? '');
  const [sidebarView, setSidebarView] = useState<'sessions' | 'params'>('sessions');

  // Live call counter display (updates during run)
  const [liveCallCount, setLiveCallCount] = useState(0);
  const [liveJsonStats, setLiveJsonStats] = useState({ attempts: 0, successes: 0 });

  // Accumulated graph for the active run
  const nodesRef = useRef<GraphNode[]>([]);
  const linksRef = useRef<GraphEdge[]>([]);
  const jsonStatsRef = useRef({ attempts: 0, successes: 0 });
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([]);
  const [graphLinks, setGraphLinks] = useState<GraphEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  // Graph panel dimensions
  const graphRef = useRef<HTMLDivElement>(null);
  const [gSize, setGSize] = useState({ w: 600, h: 700 });
  useEffect(() => {
    const upd = () => {
      if (!graphRef.current) return;
      const r = graphRef.current.getBoundingClientRect();
      if (r.width > 10 && r.height > 10) setGSize({ w: r.width, h: r.height });
    };
    upd();
    const obs = new ResizeObserver(upd);
    if (graphRef.current) obs.observe(graphRef.current);
    return () => obs.disconnect();
  }, []);

  const activeSession = sessions.find(s => s.id === activeId) ?? null;

  // Handle engine events — append nodes/links, never replace
  const handleEvent = useCallback((ev: ExecutionEvent, sid: string) => {
    if (ev.type === 'call_count') {
      setLiveCallCount(ev.count);
      return;
    }

    if (ev.type === 'json_stats') {
      jsonStatsRef.current = { attempts: ev.attempts, successes: ev.successes };
      setLiveJsonStats(jsonStatsRef.current);
      return;
    }

    const mkId = (id: string) => `${sid}::${id}`;

    if (ev.type === 'raf_node_start') {
      // Seed initial position near the parent so D3 starts with good layout.
      // Root (depth=0) gets no position — ExecutionGraph pins it to center via fx/fy.
      const parentNode = ev.parentRafNodeId
        ? nodesRef.current.find(n => n.id === mkId(ev.parentRafNodeId!))
        : null;
      const rootNode = nodesRef.current[0];
      
      let spawnX, spawnY;
      if (parentNode) {
        const spread = 80 + ev.depth * 20;
        if (rootNode && rootNode !== parentNode && parentNode.x !== undefined && parentNode.y !== undefined && rootNode.x !== undefined && rootNode.y !== undefined) {
          const dx = parentNode.x - rootNode.x;
          const dy = parentNode.y - rootNode.y;
          const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 1.5;
          spawnX = parentNode.x + Math.cos(angle) * spread;
          spawnY = parentNode.y + Math.sin(angle) * spread;
        } else {
          const angle = Math.random() * Math.PI * 2;
          spawnX = (parentNode.x ?? 0) + Math.cos(angle) * spread;
          spawnY = (parentNode.y ?? 0) + Math.sin(angle) * spread;
        }
      }

      const node: GraphNode = {
        id: mkId(ev.rafNodeId),
        type: 'raf-node',
        label: ev.label === 'root' ? 'Problem' : ev.label,
        detail: `RafNode "${ev.label}" — depth ${ev.depth}`,
        active: true,
        rafNodeId: ev.rafNodeId,
        depth: ev.depth,
        ...(parentNode ? { x: spawnX, y: spawnY } : {}),
      };
      nodesRef.current = [...nodesRef.current, node];
      if (ev.parentRafNodeId) {
        linksRef.current = [...linksRef.current, {
          id: `${mkId(ev.parentRafNodeId)}->${mkId(ev.rafNodeId)}`,
          source: mkId(ev.parentRafNodeId),
          target: mkId(ev.rafNodeId),
          edgeType: 'parallel' as const,
        }];
      }
      setGraphNodes([...nodesRef.current]);
      setGraphLinks([...linksRef.current]);
      return;
    }

    if (ev.type === 'raf_node_type') {
      const node = nodesRef.current.find(n => n.id === mkId(ev.rafNodeId));
      if (node) {
        node.caseType = ev.caseType;
      }
      setGraphNodes([...nodesRef.current]);
      return;
    }

    if (ev.type === 'raf_node_done') {
      const node = nodesRef.current.find(n => n.id === mkId(ev.rafNodeId));
      if (node) {
        node.active = false;
        node.success = ev.success;
      }
      setGraphNodes([...nodesRef.current]);
      return;
    }

    if (ev.type === 'node_start') {
      // Seed position near parent node for immediate visual placement
      const parentNode = ev.parentId
        ? nodesRef.current.find(n => n.id === mkId(ev.parentId!))
        : null;
      const rootNode = nodesRef.current[0];
      
      let spawnX, spawnY;
      if (parentNode) {
        const spread = 60;
        if (rootNode && rootNode !== parentNode && parentNode.x !== undefined && parentNode.y !== undefined && rootNode.x !== undefined && rootNode.y !== undefined) {
          const dx = parentNode.x - rootNode.x;
          const dy = parentNode.y - rootNode.y;
          const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 1.5;
          spawnX = parentNode.x + Math.cos(angle) * spread;
          spawnY = parentNode.y + Math.sin(angle) * spread;
        } else {
          const angle = Math.random() * Math.PI * 2;
          spawnX = (parentNode.x ?? 0) + Math.cos(angle) * spread;
          spawnY = (parentNode.y ?? 0) + Math.sin(angle) * spread;
        }
      }

      const node: GraphNode = {
        id: mkId(ev.nodeId),
        type: ev.nodeType,
        label: ev.label,
        detail: `${ev.nodeType}: ${ev.label}`,
        active: true,
        rafNodeId: ev.rafNodeId,
        depth: parentNode ? (parentNode.depth ?? 0) + 0.5 : 0,
        prompt: ev.prompt,
        systemPrompt: ev.systemPrompt,
        ...(parentNode ? { x: spawnX, y: spawnY } : {}),
      };
      nodesRef.current = [...nodesRef.current, node];
      if (ev.parentId) {
        linksRef.current = [...linksRef.current, {
          id: `${mkId(ev.parentId)}->${mkId(ev.nodeId)}`,
          source: mkId(ev.parentId),
          target: mkId(ev.nodeId),
          edgeType: ev.edgeType ?? 'flow' as const,
        }];
      }
      setGraphNodes([...nodesRef.current]);
      setGraphLinks([...linksRef.current]);
      return;
    }

    if (ev.type === 'node_done') {
      const node = nodesRef.current.find(n => n.id === mkId(ev.nodeId));
      if (node) {
        node.active = false;
        node.success = ev.success;
        if (ev.rawResponse) node.rawResponse = ev.rawResponse;
        if (ev.durationMs) node.durationMs = ev.durationMs;
      }
      setGraphNodes([...nodesRef.current]);
    }
  }, []);

  const launchRun = useCallback(async (problem: string) => {
    if (!problem.trim() || running) return;

    const id = uid();
    const newSession: Session = {
      id, name: short(problem, 32), ts: Date.now(),
      problem, result: null, nodes: [], links: [], callCount: 0,
    };

    // Reset graph
    nodesRef.current = [];
    linksRef.current = [];
    setGraphNodes([]);
    setGraphLinks([]);
    setSelectedNode(null);
    setLiveCallCount(0);
    setLiveJsonStats({ attempts: 0, successes: 0 });
    jsonStatsRef.current = { attempts: 0, successes: 0 };
    setActiveId(id);

    // Add session to list first so activeSession resolves immediately
    setSessions(prev => {
      const next = [newSession, ...prev];
      return next;
    });

    setRunning(true);

    try {
      const res = await fetch('/api/raf', {
        method: 'POST',
        headers: {
          'x-raf-base-case-jury-size': params.baseCaseJurySize.toString(),
          'x-raf-error-finder-jury-size': params.errorFinderJurySize.toString(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ problem })
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(`API Error ${res.status}: ${errorText}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');
      
      const decoder = new TextDecoder();
      let result: RafResult | null = null;
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.trim().startsWith('data: ')) {
            const data = JSON.parse(line.trim()?.slice(6));
            if (data.type === 'DONE') {
              result = data.result;
            } else if (data.type === 'ERROR') {
              throw new Error(data.error);
            } else {
              handleEvent(data as ExecutionEvent, id);
            }
          }
        }
      }
      
      if (!result) throw new Error('No result returned from API');

      const finalNodes = [...nodesRef.current];
      const finalLinks = [...linksRef.current];
      // Use getCallCount() — liveCallCount is stale in async closure
      const finalCallCount = getCallCount();

      // We use a mutable ref or something to get final json stats?
      // Since liveJsonStats is state, it might be stale in this async closure.
      // But we can just use the state updater pattern if needed, or assume liveJsonStats is mostly correct,
      // or we can add getJsonStats() to raf-engine.ts.
      
      setSessions(prev => {
        const next = prev.map(s => s.id === id
          ? { ...s, result, nodes: finalNodes, links: finalLinks, callCount: finalCallCount, jsonStats: { ...jsonStatsRef.current } }
          : s
        );
        return next;
      });
    } catch (e) {
      const errorMsg = e instanceof LLMCallLimitError
        ? `Hit ${MAX_LLM_CALLS} LLM call limit — problem requires more computation than the cap allows.`
        : e instanceof Error ? e.message : 'Unknown error';

      setSessions(prev => {
        const next = prev.map(s => s.id === id
          ? { ...s, error: errorMsg, nodes: [...nodesRef.current], links: [...linksRef.current], callCount: getCallCount(), jsonStats: { ...jsonStatsRef.current } }
          : s
        );
        return next;
      });
    }

    setRunning(false);
  }, [running, params, handleEvent]);

  // Restore graph when switching sessions
  useEffect(() => {
    if (!activeSession) {
      setGraphNodes([]);
      setGraphLinks([]);
      nodesRef.current = [];
      linksRef.current = [];
      return;
    }
    nodesRef.current = activeSession.nodes;
    linksRef.current = activeSession.links;
    setGraphNodes([...activeSession.nodes]);
    setGraphLinks([...activeSession.links]);
  }, [activeId]); // eslint-disable-line

  const legend = graphMode === 'full' ? [
    { c: '#00e5ff', l: 'RafNode (Pending)' },
    { c: '#69ff47', l: 'Base Case / Agent' },
    { c: '#f59e0b', l: 'Recursive Case' },
    { c: '#e040fb', l: 'Jury' },
    { c: '#ffeb3b', l: 'Consortium' },
    { c: '#f43f5e', l: 'Recovery' },
  ] : [
    { c: '#00e5ff', l: 'RafNode (Pending)' },
    { c: '#69ff47', l: 'Base Case' },
    { c: '#f59e0b', l: 'Recursive Case' },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground text-sm select-none">

      {/* ── LEFT SIDEBAR ────────────────────────────────────── */}
      <div className="flex flex-col w-60 border-r border-border bg-card shrink-0">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary shrink-0" />
            <span className="font-semibold tracking-tight">RAF Demo</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Recursive Agent Framework • Llama 3.1 8B</p>
        </div>

        {/* Sidebar tabs */}
        <div className="flex border-b border-border shrink-0">
          {(['sessions', 'params'] as const).map(v => (
            <button
              key={v}
              onClick={() => setSidebarView(v)}
              className={`flex-1 py-2 text-xs capitalize font-medium transition-colors ${
                sidebarView === v
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        {sidebarView === 'sessions' ? (
          <>
            <div className="px-3 py-2 border-b border-border shrink-0">
              <Button
                size="sm" className="w-full gap-1 text-xs h-8" disabled={running}
                onClick={() => {
                  setCustomPrompt('');
                  setActiveId('');
                  setGraphNodes([]);
                  setGraphLinks([]);
                  setSelectedNode(null);
                  nodesRef.current = [];
                  linksRef.current = [];
                }}
              >
                <Plus className="h-3.5 w-3.5" /> New Session
              </Button>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {sessions.length === 0 && (
                  <p className="text-xs text-center text-muted-foreground py-8 px-3 leading-relaxed">
                    Run a problem to create a session
                  </p>
                )}
                {sessions.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setActiveId(s.id)}
                    className={`w-full text-left px-2.5 py-2 rounded-md transition-colors group ${
                      s.id === activeId
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-accent/40 text-muted-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                        s.error ? 'bg-amber-500' :
                        s.result?.success ? 'bg-green-500' :
                        s.result ? 'bg-red-500' :
                        running && s.id === activeId ? 'bg-blue-400 animate-pulse' :
                        'bg-muted-foreground'
                      }`} />
                      <span className="text-xs font-medium text-foreground truncate flex-1">{s.name}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">{hhmm(s.ts)}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground pl-3">
                      {s.nodes.length} nodes · {s.callCount} calls
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </>
        ) : (
          <ScrollArea className="flex-1">
            <div className="p-3">
              <ParamPanel params={params} onChange={setParams} disabled={running} />
            </div>
          </ScrollArea>
        )}
      </div>

      {/* ── CENTER PANEL ────────────────────────────────────── */}
      <div className="flex flex-col w-96 border-r border-border shrink-0 min-h-0">

        {/* Tab switcher — always visible at top */}
        <div className="flex border-b border-border shrink-0 bg-card/50">
          {(['custom', 'benchmarks'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 text-xs font-medium capitalize transition-colors ${
                activeTab === tab
                  ? 'text-primary border-b-2 border-primary bg-background'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab === 'benchmarks' ? `Benchmarks (${PROBLEMS.length})` : 'Custom'}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait" initial={false}>
          {activeTab === 'custom' ? (
            <motion.div key="custom"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="flex flex-col flex-1 min-h-0"
            >
              {/* Input */}
              <div className="p-4 border-b border-border shrink-0">
                <textarea
                  value={customPrompt}
                  onChange={e => setCustomPrompt(e.target.value)}
                  placeholder="Enter any problem for RAF to solve recursively…"
                  className="w-full h-28 bg-background border border-border rounded-md p-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground font-mono"
                  disabled={running}
                />
                <Button
                  size="sm" className="w-full mt-2 gap-1.5" disabled={running || !customPrompt.trim()}
                  onClick={() => launchRun(customPrompt)}
                >
                  {running
                    ? <><span className="animate-spin inline-block">⟳</span> Running… ({liveCallCount} calls)</>
                    : <><Zap className="h-3.5 w-3.5" /> Run RAF Pipeline</>
                  }
                </Button>
              </div>
              {/* Results */}
              <ScrollArea className="flex-1">
                <ResultsPanel session={activeSession} running={running} liveCallCount={liveCallCount} liveJsonStats={liveJsonStats} nodes={graphNodes} />
              </ScrollArea>
            </motion.div>
          ) : (
            <motion.div key="benchmarks"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="flex flex-col flex-1 min-h-0"
            >
              {activeSession || running ? (
                <ScrollArea className="flex-1">
                  <ResultsPanel session={activeSession} running={running} liveCallCount={liveCallCount} liveJsonStats={liveJsonStats} nodes={graphNodes} />
                </ScrollArea>
              ) : (
                <>
                  {/* Category selector */}
                  <div className="px-3 pt-3 pb-2 border-b border-border shrink-0">
                    <div className="flex flex-wrap gap-1">
                      {CATEGORIES.map(c => (
                        <button
                          key={c}
                          onClick={() => setSelCat(c)}
                          className={`text-[10px] px-2 py-0.5 rounded-full border font-medium transition-colors ${
                            selCat === c
                              ? 'border-primary text-primary bg-primary/10'
                              : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                    {BENCHMARKS_META[selCat] && (
                      <p className="text-[10px] text-muted-foreground mt-1.5 leading-relaxed">
                        <span className="font-medium text-foreground">{BENCHMARKS_META[selCat].name}</span>
                        {' — '}{BENCHMARKS_META[selCat].description}
                      </p>
                    )}
                  </div>

                  {/* Problem list — fills remaining space */}
                  <ScrollArea className="flex-1">
                    <div className="p-2 space-y-1.5">
                      {PROBLEMS.filter(p => p.category === selCat).map(p => (
                        <button
                          key={p.id}
                          disabled={running}
                          onClick={() => launchRun(p.q)}
                          className="w-full text-left px-3 py-2.5 rounded-md border border-border hover:border-primary/50 hover:bg-accent/30 active:bg-accent/50 transition-colors text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-[10px] px-1 py-0 font-mono shrink-0">
                              {p.id}
                            </Badge>
                            {p.difficulty && (
                              <span className={`text-[10px] font-medium ${
                                p.difficulty === 'easy' ? 'text-green-400' :
                                p.difficulty === 'medium' ? 'text-amber-400' : 'text-red-400'
                              }`}>
                                {p.difficulty}
                              </span>
                            )}
                            <span className="ml-auto text-[10px] text-muted-foreground truncate">
                              → {String(p.expected || '')?.slice(0, 30)}
                            </span>
                          </div>
                          <p className="text-muted-foreground line-clamp-3 leading-relaxed">{p.q}</p>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── D3 GRAPH PANEL ──────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Graph toolbar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">Execution Graph</span>
            <Badge variant="outline" className="text-xs tabular-nums">
              {graphNodes.length} nodes
            </Badge>
            {running && (
              <Badge variant="default" className="text-xs tabular-nums animate-pulse">
                {liveCallCount} calls
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Legend */}
            <div className="hidden xl:flex items-center gap-3">
              {legend.map(l => (
                <div key={l.l} className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full shrink-0" style={{ background: l.c }} />
                  <span className="text-[10px] text-muted-foreground">{l.l}</span>
                </div>
              ))}
            </div>
            <Separator orientation="vertical" className="h-5" />
            {/* Full / Simplified toggle */}
            <div className="flex items-center gap-2">
              <Layers className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {graphMode === 'full' ? 'Full Detail' : 'Simplified'}
              </span>
              <Switch
                checked={graphMode === 'simplified'}
                onCheckedChange={v => setGraphMode(v ? 'simplified' : 'full')}
              />
            </div>
          </div>
        </div>

        {/* D3 canvas */}
        <div ref={graphRef} className="flex-1 min-h-0 relative">
          <ExecutionGraph
            nodes={graphNodes}
            links={graphLinks}
            mode={graphMode}
            width={gSize.w}
            height={gSize.h}
            onNodeClick={setSelectedNode}
            onBackgroundClick={() => setSelectedNode(null)}
          />
          
          {/* Selected Node Inspector */}
          <AnimatePresence>
            {selectedNode && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="absolute top-4 right-4 w-[400px] bg-card/95 backdrop-blur shadow-xl border border-border rounded-lg overflow-hidden flex flex-col z-10"
              >
                <div className="px-3 py-2 border-b border-border flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: { 'raf-node': '#00e5ff', jury: '#e040fb', consortium: '#ffeb3b', agent: '#69ff47', recovery: '#f43f5e', analysis: '#ff9100' }[selectedNode.type] || '#888' }} />
                    <span className="font-medium text-xs truncate">{selectedNode.label}</span>
                  </div>
                  <button onClick={() => setSelectedNode(null)} className="text-muted-foreground hover:text-foreground">
                    ✕
                  </button>
                </div>
                <div className="p-3 text-xs overflow-y-auto max-h-[80vh] flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] uppercase text-muted-foreground">Type</span>
                      <p className="capitalize">{selectedNode.type.replace('-', ' ')}</p>
                    </div>
                    {selectedNode.depth !== undefined && (
                      <div>
                        <span className="text-[10px] uppercase text-muted-foreground">Depth</span>
                        <p>{selectedNode.depth}</p>
                      </div>
                    )}
                    {selectedNode.success !== undefined && (
                      <div>
                        <span className="text-[10px] uppercase text-muted-foreground">Status</span>
                        <p className={selectedNode.success ? 'text-green-400' : 'text-red-400'}>
                          {selectedNode.success ? 'Success' : 'Failed'}
                        </p>
                      </div>
                    )}
                    {selectedNode.durationMs !== undefined && (
                      <div>
                        <span className="text-[10px] uppercase text-muted-foreground">Duration</span>
                        <p>{(selectedNode.durationMs / 1000).toFixed(2)}s</p>
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <span className="text-[10px] uppercase text-muted-foreground">Summary</span>
                    <p className="text-muted-foreground leading-relaxed mt-0.5 whitespace-pre-wrap">{selectedNode.detail}</p>
                  </div>

                  {selectedNode.prompt && (
                    <div className="mt-2">
                      <span className="text-[10px] uppercase text-muted-foreground">Input Prompt</span>
                      <div className="bg-muted/50 p-2 rounded mt-1 overflow-x-auto whitespace-pre-wrap text-[10px] font-mono border border-border/50 text-muted-foreground">
                        {selectedNode.prompt}
                      </div>
                    </div>
                  )}

                  {selectedNode.rawResponse && (
                    <div className="mt-2">
                      <span className="text-[10px] uppercase text-muted-foreground">Raw LLM Response</span>
                      <div className="bg-muted p-2 rounded mt-1 overflow-x-auto whitespace-pre-wrap text-[10px] font-mono border border-border/50 text-foreground">
                        {selectedNode.rawResponse}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RESULTS PANEL (extracted to keep App clean)
// ─────────────────────────────────────────────────────────────────────────────

function ResultsPanel({
  session,
  running,
  liveCallCount,
  liveJsonStats,
  nodes,
}: {
  session: Session | null;
  running: boolean;
  liveCallCount: number;
  liveJsonStats: { attempts: number; successes: number };
  nodes: GraphNode[];
}) {
  if (!session && !running) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-center p-6">
        <BarChart3 className="h-8 w-8 mb-2 opacity-25" />
        <p className="text-xs">Enter a problem or pick a benchmark to run the RAF pipeline</p>
      </div>
    );
  }

  const maxDepth = nodes.reduce((m, n) => Math.max(m, n.depth || 0), 0);
  const totalNodes = nodes.length;
  const errorsHandled = nodes.filter(n => n.success === false).length;
  
  const StatsStrip = () => {
    const sStats = session?.jsonStats ?? { attempts: 0, successes: 0 };
    const stats = running ? liveJsonStats : sStats;
    const rate = stats.attempts > 0 ? ((stats.successes / stats.attempts) * 100).toFixed(1) + '%' : '100%';

    return (
      <div className="grid grid-cols-2 gap-2 text-xs mb-4">
        <div className="p-2 bg-card rounded-md border border-border flex flex-col items-center justify-center text-center">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Nodes Gen</span>
          <span className="font-semibold text-foreground text-sm">{totalNodes}</span>
        </div>
        <div className="p-2 bg-card rounded-md border border-border flex flex-col items-center justify-center text-center">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">JSON Compliance</span>
          <span className="font-semibold text-foreground text-sm">{rate}</span>
        </div>
        <div className="p-2 bg-card rounded-md border border-border flex flex-col items-center justify-center text-center">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">LLM Calls</span>
          <span className="font-semibold text-primary text-sm">{running ? liveCallCount : session?.callCount ?? 0}</span>
        </div>
        <div className="p-2 bg-card rounded-md border border-border flex flex-col items-center justify-center text-center">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Errors Handled</span>
          <span className="font-semibold text-red-400 text-sm">{errorsHandled}</span>
        </div>
      </div>
    );
  };

  if (running && !session?.result) {
    return (
      <div className="p-4 space-y-2">
        <StatsStrip />
        {[1, 2, 3].map(i => (
          <div
            key={i}
            className="h-10 rounded-md bg-muted animate-pulse"
            style={{ animationDelay: `${i * 0.12}s` }}
          />
        ))}
        <p className="text-xs text-center text-muted-foreground mt-3">
          RAF pipeline running…
        </p>
      </div>
    );
  }

  if (session?.error) {
    return (
      <div className="p-4">
        <StatsStrip />
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
            <span className="text-xs font-semibold text-amber-400">Run Ended</span>
          </div>
          <p className="text-xs text-muted-foreground">{session.error}</p>
        </div>
      </div>
    );
  }

  if (!session?.result) return null;

  const r = session.result;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 space-y-3"
    >
      <StatsStrip />

      {/* Problem */}
      <div className="rounded-md border border-border bg-card/50 p-3">
        <div className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Problem</div>
        <p className="text-xs text-foreground leading-relaxed">{String(session.problem || '')?.slice(0, 300)}</p>
      </div>

      {/* Result */}
      <div className={`rounded-md border p-3 ${
        r.success ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'
      }`}>
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-xs font-semibold ${r.success ? 'text-green-400' : 'text-red-400'}`}>
            {r.success ? '✓ Solved' : '✗ Failed'}
          </span>
          <Badge variant="outline" className="text-[10px] tabular-nums">
            {session.callCount} LLM calls
          </Badge>
          {r.retries > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {r.retries} retries
            </Badge>
          )}
        </div>
        {r.answer !== undefined && (
          <div className="font-mono text-base font-bold text-foreground leading-tight break-all">
            {String(r.answer)?.slice(0, 500)}
          </div>
        )}
        {r.summary && (
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            {String(r.summary)?.slice(0, 400)}
          </p>
        )}
      </div>

      {/* Sub-tasks */}
      {Object.keys(r.children).length > 0 && (
        <div className="rounded-md border border-border p-3 space-y-1.5">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Sub-tasks</div>
          {Object.entries(r.children).map(([n, child]) => (
            <div key={n} className="flex items-start gap-2 text-xs">
              <span className={`mt-1 h-1.5 w-1.5 rounded-full shrink-0 ${
                child.success ? 'bg-green-500' : 'bg-red-500'
              }`} />
              <div className="min-w-0">
                <span className="font-medium text-foreground">{n}</span>
                {child.answer !== undefined && (
                  <span className="text-primary ml-1.5 font-mono">→ {String(child.answer)?.slice(0, 80)}</span>
                )}
                <p className="text-muted-foreground leading-relaxed">{child.summary ? String(child.summary)?.slice(0, 120) : ''}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
