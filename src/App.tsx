import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  BarChart3,
  Brain,
  ChevronDown,
  ChevronRight,
  FileText,
  FlaskConical,
  Menu,
  Plus,
  Sparkles,
  TimerReset,
  Trophy,
  X,
} from 'lucide-react';
import { benchmarkCategories, type BenchmarkProblem } from './data/benchmarks';
import { ExecutionGraph, type GraphLink, type GraphNode } from './components/ExecutionGraph';
import { runRAFPipeline, type RAFResult } from './services/raf-pipeline';
import ParameterPanel, { DEFAULT_PARAMS, type RAFParams } from './components/ParameterPanel';

interface SessionRecord {
  id: string;
  name: string;
  timestamp: number;
  problem: string;
  benchmarkId?: string;
  result?: RAFResult;
  graph: { nodes: GraphNode[]; links: GraphLink[] };
}

const STORAGE_KEY = 'raf-demo-sessions';
const ease = [0.25, 0.46, 0.45, 0.94] as const;

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function short(text: string, len = 72) {
  return text.length > len ? `${text.slice(0, len)}…` : text;
}

function buildInitialGraph(problem?: string): { nodes: GraphNode[]; links: GraphLink[] } {
  if (!problem) return { nodes: [], links: [] };
  return {
    nodes: [
      {
        id: 'problem',
        label: 'Problem',
        type: 'problem',
        color: '#3b82f6',
        radius: 30,
        fullText: problem,
        active: true,
      },
    ],
    links: [],
  };
}

function answerMatches(actual: number | string | null | undefined, expected: number | string | undefined) {
  if (actual == null || expected == null) return false;
  if (typeof actual === 'number' && typeof expected === 'number') return Math.abs(actual - expected) < 0.5;
  return String(actual).trim().toLowerCase() === String(expected).trim().toLowerCase();
}

export default function App() {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [mode, setMode] = useState<'custom' | 'benchmarks'>('custom');
  const [customPrompt, setCustomPrompt] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(benchmarkCategories[0].id);
  const [params, setParams] = useState<RAFParams>({ ...DEFAULT_PARAMS });
  const [running, setRunning] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedVoters, setExpandedVoters] = useState<number[]>([0]);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as SessionRecord[];
      setSessions(parsed);
      if (parsed[0]) setActiveSessionId(parsed[0].id);
    } catch {
      // noop
    }
  }, []);

  useEffect(() => {
    const update = () => setIsDesktop(window.innerWidth >= 1024);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  }, [sessions]);

  const activeSession = useMemo(() => sessions.find((session) => session.id === activeSessionId) ?? null, [sessions, activeSessionId]);
  const selectedCategory = useMemo(
    () => benchmarkCategories.find((category) => category.id === selectedCategoryId) ?? benchmarkCategories[0],
    [selectedCategoryId],
  );

  const aggregateStats = useMemo(() => {
    const result = activeSession?.result;
    if (!result) return null;
    const allStats = [result.decomposition.stats, ...result.voters.map((v) => v.stats)].filter(Boolean);
    const avgDecodeRate = allStats.length
      ? allStats.reduce((sum, stat) => sum + (stat?.decode_rate ?? 0), 0) / allStats.length
      : 0;
    const avgTtft = allStats.length ? allStats.reduce((sum, stat) => sum + (stat?.ttft ?? 0), 0) / allStats.length : 0;
    return {
      decodeRate: avgDecodeRate,
      ttft: avgTtft,
      totalTime: result.totalTime,
      totalTokens: result.totalTokens,
    };
  }, [activeSession]);

  function persistSession(partial: SessionRecord) {
    setSessions((current) => {
      const next = [partial, ...current.filter((item) => item.id !== partial.id)];
      return next.slice(0, 12);
    });
    setActiveSessionId(partial.id);
  }

  function createBlankSession() {
    const fresh: SessionRecord = {
      id: uid(),
      name: 'New session',
      timestamp: Date.now(),
      problem: '',
      graph: { nodes: [], links: [] },
    };
    persistSession(fresh);
    setCustomPrompt('');
    setExpandedVoters([0]);
  }

  useEffect(() => {
    if (!sessions.length) createBlankSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function launchRun(problem: string, benchmark?: BenchmarkProblem) {
    if (!problem.trim()) return;
    setRunning(true);
    setExpandedVoters([0]);

    const session: SessionRecord = {
      id: activeSession?.id ?? uid(),
      name: benchmark ? `${selectedCategory.name} · ${benchmark.id.toUpperCase()}` : short(problem, 26),
      timestamp: Date.now(),
      problem,
      benchmarkId: benchmark?.id,
      graph: buildInitialGraph(problem),
      result: undefined,
    };
    persistSession(session);

    const stageGraph = buildInitialGraph(problem);

    const updateGraph = (nodes: GraphNode[], links: GraphLink[]) => {
      stageGraph.nodes = nodes;
      stageGraph.links = links;
      persistSession({ ...session, graph: { nodes: [...nodes], links: [...links] } });
    };

    const voterColors = ['#f97316', '#22c55e', '#06b6d4', '#a855f7', '#ec4899', '#facc15', '#14b8a6'];

    const result = await runRAFPipeline(problem, (stage, data) => {

      const baseNodes = [...stageGraph.nodes];
      const baseLinks = [...stageGraph.links];

      if (stage === 'decomposing' && !baseNodes.find((n) => n.id === 'decompose')) {
        baseNodes.push({ id: 'decompose', label: 'Decompose', type: 'decompose', color: '#8b5cf6', radius: 24, active: true });
        baseLinks.push({ id: 'l-problem-decompose', source: 'problem', target: 'decompose', color: '#8b5cf6', opacity: 0.8 });
      }

      if (stage === 'decomposed') {
        const steps = (data as { steps: string[] }).steps;
        const nextNodes = baseNodes.map((node) => ({ ...node, active: node.id === 'decompose' }));
        const nextLinks = [...baseLinks];
        steps.slice(0, 5).forEach((step, index) => {
          const id = `step-${index}`;
          if (!nextNodes.find((n) => n.id === id)) {
            nextNodes.push({ id, label: `S${index + 1}`, fullText: step, type: 'step', color: '#6366f1', radius: 16, active: false });
            nextLinks.push({ id: `l-decompose-${id}`, source: 'decompose', target: id, color: '#6366f1', opacity: 0.7 });
          }
        });
        updateGraph(nextNodes, nextLinks);
        return;
      }

      if (stage === 'voter_start') {
        const { index, color, total } = data as { index: number; color: string; total: number };
        const nextNodes = baseNodes.map((node) => ({ ...node, active: false }));
        const nextLinks = [...baseLinks];
        // Add all voter placeholders on first voter start
        if (index === 0) {
          Array.from({ length: total }, (_, i) => {
            const c = voterColors[i % voterColors.length];
            const id = `voter-${i}`;
            if (!nextNodes.find((n) => n.id === id)) {
              nextNodes.push({ id, label: `Voter ${i + 1}`, type: 'voter', color: c, radius: 22, active: i === 0 });
              nextLinks.push({ id: `l-decompose-${id}`, source: 'decompose', target: id, color: c, opacity: 0.85 });
            }
          });
        } else {
          const activeId = `voter-${index}`;
          const idx = nextNodes.findIndex((n) => n.id === activeId);
          if (idx >= 0) nextNodes[idx] = { ...nextNodes[idx], active: true };
        }
        updateGraph(nextNodes, nextLinks);
        return;
      }

      if (stage === 'voting') {
        // Legacy — kept for compatibility but voter_start handles graph now
        return;
      }

      if (stage === 'voter_done') {
        const { index, answer } = data as { index: number; answer: number | string | null };
        const nextNodes = baseNodes.map((node) => ({ ...node, active: node.id === `voter-${index}` }));
        const nextLinks = [...baseLinks];
        const id = `answer-${index}`;
        if (!nextNodes.find((n) => n.id === id)) {
          nextNodes.push({ id, label: String(answer ?? '?'), fullText: String(answer ?? 'No parse'), type: 'answer', color: '#f59e0b', radius: 18, active: false });
          nextLinks.push({ id: `l-voter-answer-${index}`, source: `voter-${index}`, target: id, color: '#f59e0b', opacity: 0.85 });
        }
        updateGraph(nextNodes, nextLinks);
        return;
      }

      if (stage === 'complete') {
        const { finalAnswer } = data as { finalAnswer: number | string | null };
        const nextNodes = baseNodes.map((node) => ({ ...node, active: false }));
        const nextLinks = [...baseLinks];
        if (!nextNodes.find((n) => n.id === 'result')) {
          nextNodes.push({ id: 'result', label: String(finalAnswer ?? '?'), fullText: `Majority vote: ${String(finalAnswer ?? '?')}`, type: 'result', color: '#10b981', radius: 32, active: true });
        }
        nextNodes
          .filter((n) => n.type === 'answer' && String(n.fullText) === String(finalAnswer))
          .forEach((answerNode) => {
            if (!nextLinks.find((link) => link.id === `l-${answerNode.id}-result`)) {
              nextLinks.push({ id: `l-${answerNode.id}-result`, source: answerNode.id, target: 'result', color: '#10b981', opacity: 0.95 });
            }
          });
        updateGraph(nextNodes, nextLinks);
      }
    }, params);

    persistSession({ ...session, graph: { ...stageGraph }, result, timestamp: Date.now() });
    setRunning(false);
  }

  const benchmarkOutcome = activeSession?.benchmarkId
    ? benchmarkCategories.flatMap((category) => category.problems).find((problem) => problem.id === activeSession.benchmarkId)
    : undefined;

  return (
    <div className="relative h-screen overflow-hidden bg-[#0a0f1a] text-[#f9fafb]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.14),transparent_28%),radial-gradient(circle_at_80%_0%,rgba(139,92,246,0.18),transparent_30%),radial-gradient(circle_at_70%_100%,rgba(16,185,129,0.12),transparent_30%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.045] [background-image:radial-gradient(#fff_1px,transparent_1px)] [background-size:18px_18px]" />

      <div className="relative flex h-full flex-col lg:grid lg:grid-cols-[260px_minmax(0,1fr)_380px]">
        <div className="flex items-center justify-between border-b border-white/6 px-4 py-3 lg:hidden">
          <button onClick={() => setSidebarOpen(true)} className="rounded-xl border border-white/10 p-2 text-white">
            <Menu className="h-5 w-5" />
          </button>
          <div className="font-['Space_Grotesk'] text-lg font-semibold">RAF Demo</div>
          <button onClick={() => setSidebarOpen(false)} className="rounded-xl border border-white/10 p-2 text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <AnimatePresence>
          {(sidebarOpen || isDesktop) && (
            <motion.aside
              initial={{ x: -24, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -24, opacity: 0 }}
              transition={{ duration: 0.35, ease }}
              className="absolute inset-y-0 left-0 z-30 w-[280px] border-r border-white/6 bg-[#0f1726]/95 p-4 backdrop-blur-xl lg:static lg:w-auto"
            >
              <div className="flex h-full flex-col gap-4">
                <div className="rounded-[24px] border border-white/8 bg-white/4 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.24em] text-[#9ca3af]">Recursive Agent Framework</div>
                      <h1 className="mt-1 font-['Space_Grotesk'] text-2xl font-semibold">RAF Demo</h1>
                    </div>
                    <Sparkles className="h-5 w-5 text-[#f59e0b]" />
                  </div>
                  <motion.button
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ duration: 0.16 }}
                    onClick={createBlankSession}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6] px-4 py-3 font-medium text-white shadow-[0_12px_32px_rgba(59,130,246,0.35)]"
                  >
                    <Plus className="h-4 w-4" />
                    New session
                  </motion.button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto rounded-[24px] border border-white/8 bg-[#111827]/88 p-3">
                  <div className="mb-3 flex items-center justify-between px-2">
                    <span className="text-xs uppercase tracking-[0.2em] text-[#9ca3af]">Past sessions</span>
                    <span className="text-xs text-[#6b7280]">{sessions.length}</span>
                  </div>
                  <div className="space-y-2">
                    {sessions.map((session) => {
                      const isActive = session.id === activeSessionId;
                      const passed = answerMatches(session.result?.finalAnswer, benchmarkCategories.flatMap((c) => c.problems).find((p) => p.id === session.benchmarkId)?.expectedAnswer);
                      return (
                        <motion.button
                          key={session.id}
                          whileHover={{ y: -2 }}
                          onClick={() => {
                            setActiveSessionId(session.id);
                            setCustomPrompt(session.problem);
                            setSidebarOpen(false);
                          }}
                          className={`w-full rounded-2xl border p-3 text-left ${isActive ? 'border-[#3b82f6]/60 bg-[#1f2937] shadow-[0_12px_40px_rgba(59,130,246,0.16)]' : 'border-white/6 bg-white/[0.03]'}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate font-medium">{session.name}</div>
                              <div className="mt-1 text-xs text-[#9ca3af]">{formatTime(session.timestamp)}</div>
                            </div>
                            <div className={`mt-0.5 h-2.5 w-2.5 rounded-full ${session.result ? (session.benchmarkId ? (passed ? 'bg-[#10b981]' : 'bg-[#f43f5e]') : 'bg-[#3b82f6]') : 'bg-white/20'}`} />
                          </div>
                          <p className="mt-2 text-sm leading-5 text-[#9ca3af]">{session.problem ? short(session.problem, 82) : 'No prompt yet.'}</p>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        <main className="min-h-0 overflow-y-auto px-4 pb-6 pt-4 lg:px-6 lg:py-6">
          <div className="mx-auto flex max-w-6xl flex-col gap-6">
            <motion.header initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease }} className="rounded-[28px] border border-white/8 bg-[#111827]/84 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur-xl">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-3xl">
                  <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-[#9ca3af]">
                    <Brain className="h-4 w-4 text-[#8b5cf6]" />
                    Small model, bigger outcome
                  </div>
                  <h2 className="max-w-3xl font-['Space_Grotesk'] text-4xl font-semibold tracking-[-0.03em] text-white lg:text-5xl">
                    Structured decomposition lets an <span className="text-[#3b82f6]">8B model</span> punch absurdly above its weight.
                  </h2>
                  <p className="mt-4 max-w-2xl text-[15px] leading-7 text-[#9ca3af]">
                    RAF splits a hard reasoning task into steps, spins up three independent solver traces, and majority-votes the answer. Same model. Better orchestration. Better reliability.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[{ label: 'GSM8K', value: '92%', note: 'RAF + 8B' }, { label: '70B baseline', value: '83.7%', note: 'single-pass' }].map((metric) => (
                    <motion.div key={metric.label} whileHover={{ y: -3 }} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-[#9ca3af]">{metric.label}</div>
                      <div className="mt-2 font-['Space_Grotesk'] text-3xl font-semibold text-white">{metric.value}</div>
                      <div className="mt-1 text-sm text-[#9ca3af]">{metric.note}</div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.header>

            <section className="rounded-[28px] border border-white/8 bg-[#111827]/82 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl lg:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 rounded-2xl bg-white/[0.04] p-1">
                  {[
                    { id: 'custom', label: 'Custom Prompt', icon: FlaskConical },
                    { id: 'benchmarks', label: 'Benchmarks', icon: Trophy },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    const active = mode === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setMode(tab.id as 'custom' | 'benchmarks')}
                        className={`rounded-[14px] px-4 py-2.5 text-sm font-medium ${active ? 'bg-white text-[#0a0f1a]' : 'text-[#9ca3af]'}`}
                      >
                        <span className="flex items-center gap-2"><Icon className="h-4 w-4" />{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <a href="/raf-demo/RAF-Paper.pdf" target="_blank" rel="noreferrer" className="rounded-2xl border border-white/10 px-4 py-2 text-sm text-[#d1d5db] hover:bg-white/[0.04]">
                    <span className="flex items-center gap-2"><FileText className="h-4 w-4" /> Read the paper</span>
                  </a>
                </div>
              </div>

              <div className="mb-4">
                <ParameterPanel params={params} onChange={setParams} disabled={running} />
              </div>

              {mode === 'custom' ? (
                <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
                  <div className="rounded-[24px] border border-white/8 bg-[#0d1524] p-4">
                    <label className="mb-2 block text-sm font-medium text-[#d1d5db]">Enter a problem</label>
                    <textarea
                      value={customPrompt}
                      onChange={(event) => setCustomPrompt(event.target.value)}
                      placeholder="e.g. A merchant wants to make a choice of purchase between 2 purchase plans..."
                      className="h-44 w-full resize-none rounded-2xl border border-white/8 bg-[#0a0f1a] px-4 py-3 text-[15px] leading-6 text-white outline-none ring-0 placeholder:text-[#6b7280] focus:border-[#3b82f6]/70"
                    />
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm text-[#9ca3af]">Run the full recursive decomposition + {params.numVoters}-voter {params.votingStrategy} pipeline.</p>
                      <motion.button
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        disabled={running || !customPrompt.trim()}
                        onClick={() => launchRun(customPrompt)}
                        className="rounded-2xl bg-gradient-to-r from-[#10b981] to-[#3b82f6] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <span className="flex items-center gap-2">{running ? <TimerReset className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} Run RAF Pipeline</span>
                      </motion.button>
                    </div>
                  </div>
                  <div className="rounded-[24px] border border-white/8 bg-[#0d1524] p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-[#9ca3af]">Why this works</div>
                    <div className="mt-3 space-y-3 text-sm leading-6 text-[#cbd5e1]">
                      <div className="rounded-2xl border border-white/6 bg-white/[0.03] p-3">1. Decompose the problem into explicit intermediate computations.</div>
                      <div className="rounded-2xl border border-white/6 bg-white/[0.03] p-3">2. Solve three times with independent stochastic traces.</div>
                      <div className="rounded-2xl border border-white/6 bg-white/[0.03] p-3">3. Majority-vote the extracted answer to suppress single-run failure modes.</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid gap-5 lg:grid-cols-[0.92fr_1.08fr]">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {benchmarkCategories.map((category) => (
                      <motion.button
                        key={category.id}
                        whileHover={{ y: -3 }}
                        onClick={() => setSelectedCategoryId(category.id)}
                        className={`rounded-[24px] border p-4 text-left ${selectedCategoryId === category.id ? 'border-white/12 bg-white/[0.09]' : 'border-white/6 bg-white/[0.03]'}`}
                      >
                        <div className="text-2xl">{category.icon}</div>
                        <div className="mt-3 font-['Space_Grotesk'] text-xl font-semibold">{category.name}</div>
                        <div className="mt-2 text-sm leading-6 text-[#9ca3af]">{category.description}</div>
                        <div className="mt-4 text-xs uppercase tracking-[0.18em]" style={{ color: category.color }}>{category.problems.length} problems</div>
                      </motion.button>
                    ))}
                  </div>
                  <div className="rounded-[24px] border border-white/8 bg-[#0d1524] p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-[#9ca3af]">Selected benchmark</div>
                        <div className="mt-1 font-['Space_Grotesk'] text-2xl font-semibold">{selectedCategory.name}</div>
                      </div>
                      <div className="rounded-2xl px-3 py-2 text-xs uppercase tracking-[0.18em]" style={{ backgroundColor: `${selectedCategory.color}20`, color: selectedCategory.color }}>
                        Structured reasoning
                      </div>
                    </div>
                    <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
                      {selectedCategory.problems.map((problem) => (
                        <motion.button
                          key={problem.id}
                          whileHover={{ y: -2 }}
                          onClick={() => launchRun(problem.question, problem)}
                          className="w-full rounded-2xl border border-white/6 bg-white/[0.03] p-4 text-left"
                        >
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <span className="text-xs uppercase tracking-[0.18em] text-[#9ca3af]">{problem.id.toUpperCase()}</span>
                            <span className="text-xs text-[#6b7280]">Expected: {String(problem.expectedAnswer).slice(0, 20)}</span>
                          </div>
                          <p className="text-sm leading-6 text-[#e5e7eb]">{problem.question}</p>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="rounded-[28px] border border-white/8 bg-[#111827]/82 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl">
                {!activeSession?.problem ? (
                  <div className="flex min-h-[320px] items-center justify-center rounded-[24px] border border-dashed border-white/10 bg-[#0d1524] text-center text-[#9ca3af]">
                    <div>
                      <BarChart3 className="mx-auto mb-3 h-8 w-8 text-[#3b82f6]" />
                      <p>Pick a benchmark or enter a custom prompt to watch RAF execute.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="rounded-[24px] border border-white/8 bg-[#0d1524] p-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-[#9ca3af]">Current problem</div>
                      <p className="mt-3 text-[15px] leading-7 text-[#e5e7eb]">{activeSession.problem}</p>
                    </div>

                    {aggregateStats && (
                      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="grid gap-3 sm:grid-cols-4">
                        {[
                          { label: 'Tokens / sec', value: aggregateStats.decodeRate.toFixed(1) },
                          { label: 'TTFT', value: `${aggregateStats.ttft.toFixed(2)}s` },
                          { label: 'Total time', value: `${aggregateStats.totalTime.toFixed(2)}s` },
                          { label: 'Tokens', value: String(Math.round(aggregateStats.totalTokens)) },
                        ].map((stat) => (
                          <div key={stat.label} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                            <div className="text-xs uppercase tracking-[0.18em] text-[#9ca3af]">{stat.label}</div>
                            <div className="mt-2 font-['Space_Grotesk'] text-2xl font-semibold">{stat.value}</div>
                          </div>
                        ))}
                      </motion.div>
                    )}

                    {activeSession.result ? (
                      <>
                        <div className="rounded-[24px] border border-[#10b981]/20 bg-[linear-gradient(135deg,rgba(16,185,129,0.12),rgba(59,130,246,0.08))] p-5">
                          <div className="flex flex-wrap items-center justify-between gap-4">
                            <div>
                              <div className="text-xs uppercase tracking-[0.2em] text-[#9ca3af]">Majority vote result</div>
                              <div className="mt-2 font-['Space_Grotesk'] text-4xl font-semibold text-white">{String(activeSession.result.finalAnswer ?? '—')}</div>
                              <div className="mt-2 text-sm text-[#cbd5e1]">Confidence: {activeSession.result.confidence}/3 voters agreed</div>
                            </div>
                            {benchmarkOutcome && (
                              <div className={`rounded-2xl border px-4 py-3 text-sm ${answerMatches(activeSession.result.finalAnswer, benchmarkOutcome.expectedAnswer) ? 'border-[#10b981]/30 bg-[#10b981]/10 text-[#d1fae5]' : 'border-[#f43f5e]/30 bg-[#f43f5e]/10 text-[#ffe4e6]'}`}>
                                Expected: {String(benchmarkOutcome.expectedAnswer)} {answerMatches(activeSession.result.finalAnswer, benchmarkOutcome.expectedAnswer) ? '✓' : '✗'}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="rounded-[24px] border border-white/8 bg-[#0d1524] p-4">
                          <div className="mb-4 text-xs uppercase tracking-[0.2em] text-[#9ca3af]">Decomposition steps</div>
                          <div className="space-y-3">
                            {activeSession.result.decomposition.steps.map((step, index) => (
                              <motion.div
                                key={step}
                                initial={{ opacity: 0, y: 18 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.45, delay: index * 0.15, ease }}
                                className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm text-[#e5e7eb]"
                              >
                                {step}
                              </motion.div>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-[24px] border border-white/8 bg-[#0d1524] p-4">
                          <div className="mb-4 text-xs uppercase tracking-[0.2em] text-[#9ca3af]">Three voter responses</div>
                          <div className="space-y-3">
                            {activeSession.result.voters.map((voter, index) => {
                              const open = expandedVoters.includes(index);
                              return (
                                <div key={index} className="overflow-hidden rounded-2xl border border-white/8 bg-white/[0.03]">
                                  <button
                                    onClick={() => setExpandedVoters((current) => (open ? current.filter((n) => n !== index) : [...current, index]))}
                                    className="flex w-full items-center justify-between gap-3 p-4 text-left"
                                  >
                                    <div>
                                      <div className="font-medium text-white">Voter {index + 1}</div>
                                      <div className="mt-1 text-sm text-[#9ca3af]">Extracted answer: {String(voter.answer ?? '—')}</div>
                                    </div>
                                    {open ? <ChevronDown className="h-4 w-4 text-[#9ca3af]" /> : <ChevronRight className="h-4 w-4 text-[#9ca3af]" />}
                                  </button>
                                  <AnimatePresence>
                                    {open && (
                                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-white/8">
                                        <pre className="overflow-x-auto whitespace-pre-wrap p-4 font-['JetBrains_Mono'] text-xs leading-6 text-[#cbd5e1]">{voter.response}</pre>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    ) : running ? (
                      <div className="space-y-3 rounded-[24px] border border-white/8 bg-[#0d1524] p-4">
                        {[1, 2, 3, 4].map((item) => (
                          <div key={item} className="skeleton h-16 w-full rounded-2xl" />
                        ))}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              <aside className="rounded-[28px] border border-white/8 bg-[#111827]/82 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl">
                <div className="mb-3 flex items-center justify-between px-1">
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-[#9ca3af]">Showcase feature</div>
                    <div className="mt-1 font-['Space_Grotesk'] text-2xl font-semibold">Execution Graph</div>
                  </div>
                  <div className="rounded-full border border-white/10 px-3 py-1 text-xs text-[#9ca3af]">D3.js</div>
                </div>
                <div className="h-[360px] rounded-[24px] border border-white/8 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.08),transparent_35%),#0a0f1a] lg:h-[760px]">
                  <ExecutionGraph nodes={activeSession?.graph.nodes ?? []} links={activeSession?.graph.links ?? []} />
                </div>
              </aside>
            </section>
          </div>
        </main>

      </div>
    </div>
  );
}
