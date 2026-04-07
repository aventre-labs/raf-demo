import { callLLM, setSimulationMode, type ChatMessage } from '../services/chatjimmy';
import type { RAFParams, ExecutionEvent } from './types';

type EventCb = (e: ExecutionEvent) => void;

let _cb: EventCb | null = null;
let _ctr = 0;

function nid(prefix: string) { return `${prefix}-${++_ctr}`; }
function emit(e: ExecutionEvent) { _cb?.(e); }

const SYS = {
  baseCaseVote: `You are a task classifier for a recursive agent system.
Decide if a task is a BASE CASE (directly solvable, atomic) or RECURSIVE CASE (needs decomposition into sub-tasks).
BASE CASE: single arithmetic problem, single-step reasoning, simple factual question.
RECURSIVE CASE: multi-step problem requiring distinct independent sub-tasks.
Respond with EXACTLY: "Base Case" or "Recursive Case" — nothing else.`,

  designAgent: `You are an agent designer. Given a problem, output a JSON execution plan:
{"approach":"step-by-step method","key_operations":["op1","op2"],"expected_output":"description"}
Respond ONLY with valid JSON. No markdown.`,

  designJury: `You are selecting the best execution plan from a numbered list.
Respond with ONLY the index number (e.g. "0" or "1"). Nothing else.`,

  execute: `You are a careful problem solver. 
Use the given approach to solve the problem step by step.
Show your reasoning clearly.
End ALWAYS with "#### <answer>" on its own line where <answer> is your final answer.`,

  analysisAgent: `You are evaluating a task execution result.
Output JSON: {"success":true/false,"info":"what happened and what the answer is"}
Respond ONLY with valid JSON. No markdown.`,

  analysisJury: `Select the best analysis from a numbered list.
Respond ONLY with the index number. Nothing else.`,

  planAgent: `You are a recursive planner. Break the problem into 2-3 atomic sub-tasks.
Each sub-task should be independently solvable.
Output JSON array: [{"name":"step-id","context":"full description of sub-task","dependsOn":[]}]
First sub-task: dependsOn:[]. Later tasks may reference earlier by name.
Respond ONLY with valid JSON array. No markdown.`,

  planJury: `Select the best decomposition plan from a numbered list.
Respond ONLY with the index number. Nothing else.`,
};

async function consortium<T>(
  label: string, parentId: string, rafNodeId: string, size: number, topK: number,
  sys: string, makeUserMsg: () => string,
  parse: (t: string) => T | null,
): Promise<T[]> {
  const cid = nid('consortium');
  emit({ type: 'node_start', nodeId: cid, label: `${label} (n=${size})`, nodeType: 'consortium', parentId, rafNodeId, edgeType: 'flow' });
  const results: T[] = [];
  await Promise.all(Array.from({ length: size }, async (_, i) => {
    const aid = nid('agent');
    emit({ type: 'node_start', nodeId: aid, label: `Agent ${i + 1}`, nodeType: 'agent', parentId: cid, rafNodeId, edgeType: 'parallel' });
    const msgs: ChatMessage[] = [{ role: 'user', content: makeUserMsg() }];
    const r = await callLLM(msgs, sys, topK);
    const parsed = parse(r.text);
    emit({ type: 'node_done', nodeId: aid, success: parsed !== null, summary: r.text.slice(0, 60) });
    if (parsed !== null) results.push(parsed);
  }));
  emit({ type: 'node_done', nodeId: cid, success: results.length > 0, summary: `${results.length}/${size} valid` });
  return results;
}

async function jury<T>(
  label: string, parentId: string, rafNodeId: string, size: number, topK: number,
  options: T[], sys: string, makeUserMsg: () => string,
): Promise<T> {
  const jid = nid('jury');
  emit({ type: 'node_start', nodeId: jid, label: `${label} (n=${size})`, nodeType: 'jury', parentId, rafNodeId, edgeType: 'flow' });
  const tallies: Record<number, number> = {};
  await Promise.all(Array.from({ length: size }, async (_, i) => {
    const vid = nid('agent');
    emit({ type: 'node_start', nodeId: vid, label: `Voter ${i + 1}`, nodeType: 'agent', parentId: jid, rafNodeId, edgeType: 'parallel' });
    const msgs: ChatMessage[] = [{ role: 'user', content: makeUserMsg() }];
    const r = await callLLM(msgs, sys, topK);
    const idx = Math.max(0, Math.min(parseInt(r.text.trim().replace(/\D/g, '') || '0'), options.length - 1));
    tallies[idx] = (tallies[idx] ?? 0) + 1;
    emit({ type: 'node_done', nodeId: vid, success: true, summary: `→ option ${idx}` });
  }));
  const winner = Number(Object.entries(tallies).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0);
  emit({ type: 'node_done', nodeId: jid, success: true, summary: `Winner: #${winner}` });
  return options[winner] ?? options[0];
}

export interface RafResult {
  name: string; success: boolean; summary: string; answer?: string;
  children: Record<string, RafResult>;
}

type Plan = { name: string; context: string; dependsOn: string[] };

export async function execRafNode(
  context: string, params: RAFParams,
  depth: number, name: string,
  parentRafId?: string, depSummary?: string,
): Promise<RafResult> {
  const rid = nid('raf');
  emit({ type: 'raf_node_start', rafNodeId: rid, parentRafNodeId: parentRafId, label: name, depth });

  const tk = Math.round((params.minTopK + params.maxTopK) / 2);
  const ctx = depSummary ? `Context from dependencies:\n${depSummary}\n\nCurrent task:\n${context}` : context;

  const voteJuryId = nid('jury');
  emit({ type: 'node_start', nodeId: voteJuryId, label: `Base Case Jury (n=${params.baseCaseJurySize})`, nodeType: 'jury', parentId: rid, rafNodeId: rid, edgeType: 'flow' });

  const voteTallies: Record<string, number> = {};
  await Promise.all(Array.from({ length: params.baseCaseJurySize }, async (_, i) => {
    const vid = nid('agent');
    emit({ type: 'node_start', nodeId: vid, label: `Voter ${i + 1}`, nodeType: 'agent', parentId: voteJuryId, rafNodeId: rid, edgeType: 'parallel' });
    const r = await callLLM([{ role: 'user', content: `Task to classify:\n${ctx}` }], SYS.baseCaseVote, tk);
    const vote = r.text.toLowerCase().includes('base') ? 'Base Case' : 'Recursive Case';
    voteTallies[vote] = (voteTallies[vote] ?? 0) + 1;
    emit({ type: 'node_done', nodeId: vid, success: true, summary: vote });
  }));

  const isBase = depth >= params.maxDepth || (voteTallies['Base Case'] ?? 0) >= (voteTallies['Recursive Case'] ?? 0);
  emit({ type: 'node_done', nodeId: voteJuryId, success: true, summary: isBase ? '→ Base Case' : '→ Recursive Case' });

  if (isBase) {
    type Design = { approach: string; key_operations: string[]; expected_output: string };
    const tryParseDesign = (t: string): Design | null => {
      try { return JSON.parse(t.match(/\{[\s\S]+\}/)?.[0] ?? 'null'); }
      catch { return { approach: t.slice(0, 200), key_operations: [], expected_output: 'answer' }; }
    };

    const designs = await consortium<Design>(
      'Design Consortium', rid, rid, params.baseCaseConsortiumSize, tk,
      SYS.designAgent, () => `Design a plan to solve:\n${ctx}`, tryParseDesign
    );
    const designOpts = designs.length > 0 ? designs : [{ approach: 'Direct computation.', key_operations: [], expected_output: 'answer' }];

    const bestDesign = await jury<Design>(
      'Design Jury', rid, rid, params.baseCaseDesignJurySize, tk, designOpts,
      SYS.designJury, () => `Choose best plan:\n${designOpts.map((d, i) => `[${i}] ${JSON.stringify(d)}`).join('\n')}`
    );

    const eid = nid('agent');
    emit({ type: 'node_start', nodeId: eid, label: 'Execute', nodeType: 'agent', parentId: rid, rafNodeId: rid, edgeType: 'flow' });
    const execR = await callLLM(
      [{ role: 'user', content: `Problem: ${ctx}\n\nApproach: ${bestDesign.approach}\n\nSolve step by step:` }],
      SYS.execute, tk
    );
    emit({ type: 'node_done', nodeId: eid, success: true, summary: execR.text.slice(0, 80) });

    const answer = execR.text.match(/####\s*(.+)$/m)?.[1]?.trim() ?? execR.text.slice(-120);

    type Analysis = { success: boolean; info: string };
    const tryParseAnalysis = (t: string): Analysis | null => {
      try { return JSON.parse(t.match(/\{[\s\S]+\}/)?.[0] ?? 'null'); }
      catch { return { success: true, info: t.slice(0, 200) }; }
    };

    const analyses = await consortium<Analysis>(
      'Analysis Consortium', rid, rid, params.analysisConsortiumSize, tk,
      SYS.analysisAgent, () => `Task: ${ctx}\n\nResult: ${execR.text}`, tryParseAnalysis
    );
    const anaOpts = analyses.length > 0 ? analyses : [{ success: true, info: `Answer: ${answer}` }];

    const finalAna = await jury<Analysis>(
      'Analysis Jury', rid, rid, params.analysisJurySize, tk, anaOpts,
      SYS.analysisJury, () => `Choose best analysis:\n${anaOpts.map((a, i) => `[${i}] ${JSON.stringify(a)}`).join('\n')}`
    );

    emit({ type: 'raf_node_done', rafNodeId: rid, success: finalAna.success, summary: answer });
    return { name, success: finalAna.success, summary: finalAna.info, answer, children: {} };

  } else {
    const tryParsePlan = (t: string): Plan[] | null => {
      try {
        const arr = JSON.parse(t.match(/\[[\s\S]+\]/)?.[0] ?? 'null');
        return Array.isArray(arr) && arr.length > 0 ? arr : null;
      } catch { return null; }
    };

    const plans = await consortium<Plan[]>(
      'Plan Consortium', rid, rid, params.planConsortiumSize, tk,
      SYS.planAgent, () => `Decompose into sub-tasks:\n${ctx}`, tryParsePlan
    );

    const fallbackPlan: Plan[] = [
      { name: 'sub-1', context: ctx.slice(0, Math.floor(ctx.length / 2)), dependsOn: [] },
      { name: 'sub-2', context: ctx.slice(Math.floor(ctx.length / 2)), dependsOn: ['sub-1'] },
    ];
    const planOpts = plans.length > 0 ? plans : [fallbackPlan];

    const chosenPlan = await jury<Plan[]>(
      'Plan Jury', rid, rid, params.planJurySize, tk, planOpts,
      SYS.planJury, () => `Choose best plan:\n${planOpts.map((p, i) => `[${i}] ${JSON.stringify(p)}`).join('\n')}`
    );

    const childResults: Record<string, RafResult> = {};
    const done = new Set<string>();

    const execChild = async (plan: Plan): Promise<void> => {
      while (plan.dependsOn.some(d => !done.has(d))) {
        await new Promise(r => setTimeout(r, 50));
      }
      const depCtx = plan.dependsOn.map(d => childResults[d]?.summary ?? '').filter(Boolean).join('\n');
      childResults[plan.name] = await execRafNode(plan.context, params, depth + 1, plan.name, rid, depCtx || undefined);
      done.add(plan.name);
    };

    await Promise.all(chosenPlan.map(execChild));

    const allSummaries = Object.entries(childResults).map(([n, r]) => `${n}: ${r.summary}`).join('\n');

    type Analysis = { success: boolean; info: string };
    const tryParseAnalysis = (t: string): Analysis | null => {
      try { return JSON.parse(t.match(/\{[\s\S]+\}/)?.[0] ?? 'null'); }
      catch { return { success: true, info: t.slice(0, 200) }; }
    };

    const analyses = await consortium<Analysis>(
      'Analysis Consortium', rid, rid, params.analysisConsortiumSize, tk,
      SYS.analysisAgent, () => `Original task: ${ctx}\n\nSub-task results:\n${allSummaries}`, tryParseAnalysis
    );
    const anaOpts = analyses.length > 0 ? analyses : [{ success: true, info: allSummaries }];

    const finalAna = await jury<Analysis>(
      'Analysis Jury', rid, rid, params.analysisJurySize, tk, anaOpts,
      SYS.analysisJury, () => `Choose best analysis:\n${anaOpts.map((a, i) => `[${i}] ${JSON.stringify(a)}`).join('\n')}`
    );

    const childAnswers = Object.values(childResults).map(r => r.answer).filter(Boolean).join('; ');
    emit({ type: 'raf_node_done', rafNodeId: rid, success: finalAna.success, summary: finalAna.info });

    return { name, success: finalAna.success, summary: finalAna.info, answer: childAnswers || finalAna.info, children: childResults };
  }
}

export function runRAF(problem: string, params: RAFParams, onEvent: EventCb): Promise<RafResult> {
  _ctr = 0;
  _cb = onEvent;
  setSimulationMode(params.simulationMode);
  return execRafNode(problem, params, 0, 'root');
}
