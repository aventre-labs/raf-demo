import { callLLM, resetCallCount, setCallCountCallback, type ChatMessage } from '../services/chatjimmy';
import type { RAFParams, ExecutionEvent } from './types';
import { MAX_LLM_CALLS, MAX_RECURSION_DEPTH } from './types';

type EventCb = (e: ExecutionEvent) => void;

let _cb: EventCb | null = null;
let _nid = 0;
let _jsonAttempts = 0;
let _jsonSuccesses = 0;

function nid(prefix: string) { return `${prefix}-${++_nid}`; }
function emit(e: ExecutionEvent) { _cb?.(e); }

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPTS
// Biased strongly toward RECURSIVE decomposition to showcase deep agent trees.
// ─────────────────────────────────────────────────────────────────────────────

const SYS = {
  baseCaseVote: `You are a task classifier for a Recursive Agent Framework (RAF).
Your job is to decide if a task should be solved directly (BASE CASE) or broken into sub-tasks (RECURSIVE CASE).

PREFER RECURSIVE CASE. Only classify as BASE CASE if the task meets ALL of the following:
  1. It is a single, atomic arithmetic expression (one operation)
  2. It has no sub-steps whatsoever
  3. A human could answer it in under 3 seconds mentally

Examples:
  "What is 7 + 8?" → Base Case
  "Write a function to check palindromes" → Recursive Case
  "Janet's ducks lay 16 eggs..." → Recursive Case (multiple logical steps)
  "What is 2^100 mod 7?" → Recursive Case (requires algorithm)
  "Sort this list: [3,1,2]" → Recursive Case (algorithm with sub-steps)
  "Fix this bug in the code:" → Recursive Case (diagnosis + fix + verify)

When in doubt: choose RECURSIVE CASE. Decomposition produces better results.

Respond with EXACTLY one of: "Base Case" or "Recursive Case" — nothing else.`,

  designAgent: `You are an expert execution planner for an AI agent system.
Given a problem, produce a detailed JSON execution plan:
{
  "approach": "step-by-step method with specific techniques",
  "key_operations": ["concrete operation 1", "concrete operation 2", "..."],
  "tools_needed": ["calculator", "code_interpreter", "search"] (list only what applies),
  "expected_output": "precise description of what the answer looks like"
}
Be specific and technical. Bad: "solve it". Good: "Apply modular exponentiation using Euler's theorem".
Respond ONLY with valid JSON. No markdown fences.`,

  designJury: `You are selecting the best execution plan from a numbered list.
Evaluate each plan for: specificity, correctness of approach, and likelihood of success.
Respond with ONLY the index number of the best plan (e.g. "0" or "2"). Nothing else.`,

  execute: `You are a precise expert problem solver with access to these conceptual tools:
- CALCULATOR: for arithmetic (show each step)
- CODE: for algorithms (write and trace through the code mentally)  
- SEARCH: for factual lookup (reason from your training knowledge)
- ANALYZE: for breaking down complex structures

Work through the problem systematically using the given approach.
Show ALL intermediate steps — do not skip any reasoning.
For code problems: write the complete solution, then trace through with a test case.
For math: show every arithmetic operation explicitly.

End ALWAYS with a line: "#### <your final answer>"
The answer after #### should be the direct, concise answer (a number, code snippet, or short text).`,

  analysisAgent: `You are a rigorous quality assessor for an AI agent execution result.
Evaluate whether the execution ACTUALLY SOLVED the original problem correctly.

Check: 
1. Is the answer complete and addresses all parts of the question?
2. Are all calculations/logic steps correct?
3. Is the output in the expected format?
4. Would a domain expert consider this correct?

Output JSON: {"success": true/false, "info": "specific assessment including what was computed and whether it's correct"}
Be strict — only mark success:true if you are confident the answer is correct.
Respond ONLY with valid JSON. No markdown.`,

  analysisJury: `Select the STRICTEST, most accurate analysis from a numbered list.
Prefer analyses that catch errors over ones that are overly optimistic.
Respond ONLY with the index number. Nothing else.`,

  planAgent: `You are a recursive decomposition planner for a Recursive Agent Framework.
Break the problem into 2-4 independent sub-tasks that can each be solved recursively.

Guidelines:
- Each sub-task should be a meaningful, self-contained piece of the problem
- Sub-tasks should be specific enough to be solvable but complex enough to benefit from recursion
- Use dependsOn to chain tasks that need previous results
- Name tasks descriptively (e.g. "parse-input", "compute-modular-exp", "verify-result")

Output JSON array:
[
  {"name": "descriptive-task-id", "context": "FULL self-contained description of this sub-task, including all relevant info from the parent", "dependsOn": []},
  {"name": "next-task", "context": "...", "dependsOn": ["descriptive-task-id"]}
]

IMPORTANT: Each sub-task's "context" must be fully self-contained — it cannot assume the child agent has seen the parent's context.
Respond ONLY with a valid JSON array. No markdown.`,

  planJury: `Select the best decomposition plan from a numbered list.
Prefer plans that: (1) have more granular, specific sub-tasks, (2) correctly identify dependencies, (3) cover all aspects of the problem.
Respond ONLY with the index number. Nothing else.`,

  errorFinderJury: `You are an error attribution expert for a Recursive Agent Framework.
A task execution failed. You must decide: IS THIS NODE responsible for the failure?

Vote YES if:
- The execution logic at this node was flawed
- The approach chosen was wrong for this problem  
- The implementation had a specific error
- This is the ROOT node (root is always responsible by default)

Vote NO if:
- A child sub-task produced the wrong input to this node
- This node's logic was correct but it received bad data from dependencies

Respond with EXACTLY: "YES" or "NO" — nothing else.`,

  recoveryConsortium: `You are a recovery strategy designer for a failed AI agent execution.
The previous approach FAILED. Generate a COMPLETELY DIFFERENT strategy.

Analyze what went wrong and propose an alternative approach that:
1. Uses a fundamentally different method than what failed
2. Is more likely to succeed on this specific problem type
3. Addresses the specific failure mode

Output JSON:
{
  "failure_analysis": "specific reason why the previous approach failed",
  "new_approach": "completely different method",
  "key_differences": ["difference 1", "difference 2"],
  "confidence": "high/medium/low"
}
Respond ONLY with valid JSON. No markdown.`,

  recoveryJury: `You are selecting the best RECOVERY strategy from a numbered list after a failed execution.
Pick the strategy most likely to succeed — prefer ones with clear failure analysis and novel approaches.
Respond ONLY with the index number. Nothing else.`,
};

// ─────────────────────────────────────────────────────────────────────────────
// CONSORTIUM — parallel agents each produce one result
// ─────────────────────────────────────────────────────────────────────────────

async function consortium<T>(
  label: string,
  parentId: string,
  rafNodeId: string,
  size: number,
  topK: number,
  sys: string,
  makeUserMsg: () => string,
  parse: (t: string) => T | null,
): Promise<T[]> {
  const cid = nid('consortium');
  const userMsg = makeUserMsg();
  emit({ type: 'node_start', nodeId: cid, label: `${label} (n=${size})`, nodeType: 'consortium', parentId, rafNodeId, edgeType: 'flow', prompt: userMsg, systemPrompt: sys });
  const results: T[] = [];
  const startCid = Date.now();

  await Promise.all(Array.from({ length: size }, async (_, i) => {
    const aid = nid('agent');
    emit({ type: 'node_start', nodeId: aid, label: `Agent ${i + 1}`, nodeType: 'agent', parentId: cid, rafNodeId, edgeType: 'parallel', prompt: userMsg, systemPrompt: sys });
    const msgs: ChatMessage[] = [{ role: 'user', content: userMsg }];
    
    let parsed: T | null = null;
    let attempts = 0;
    let lastText = '';
    const startAid = Date.now();
    
    while (parsed === null && attempts < 5) {
      attempts++;
      const r = await callLLM(msgs, sys, topK, MAX_LLM_CALLS);
      lastText = r.text;
      _jsonAttempts++;
      parsed = parse(r.text);
      if (parsed !== null) _jsonSuccesses++;
      emit({ type: 'json_stats', attempts: _jsonAttempts, successes: _jsonSuccesses });
      
      if (parsed === null && attempts < 5) {
        msgs.push({ role: 'assistant', content: lastText });
        msgs.push({ role: 'user', content: 'Your response was not perfectly structured JSON. Please output ONLY valid JSON matching the requested schema.' });
      }
    }

    emit({ type: 'node_done', nodeId: aid, success: parsed !== null, summary: lastText?.slice(0, 80), rawResponse: lastText, durationMs: Date.now() - startAid });
    if (parsed !== null) results.push(parsed);
  }));

  emit({ type: 'node_done', nodeId: cid, success: results.length > 0, summary: `${results.length}/${size} valid`, durationMs: Date.now() - startCid });
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// JURY — parallel voters select the best option
// ─────────────────────────────────────────────────────────────────────────────

async function jury<T>(
  label: string,
  parentId: string,
  rafNodeId: string,
  size: number,
  topK: number,
  options: T[],
  sys: string,
  makeUserMsg: () => string,
): Promise<T> {
  if (options.length === 0) throw new Error(`Jury "${label}" received empty options`);
  if (options.length === 1) return options[0];

  const jid = nid('jury');
  const userMsg = makeUserMsg();
  emit({ type: 'node_start', nodeId: jid, label: `${label} (n=${size})`, nodeType: 'jury', parentId, rafNodeId, edgeType: 'flow', prompt: userMsg, systemPrompt: sys });
  const tallies: Record<number, number> = {};
  const startJid = Date.now();

  await Promise.all(Array.from({ length: size }, async (_, i) => {
    const vid = nid('agent');
    emit({ type: 'node_start', nodeId: vid, label: `Voter ${i + 1}`, nodeType: 'agent', parentId: jid, rafNodeId, edgeType: 'parallel', prompt: userMsg, systemPrompt: sys });
    const msgs: ChatMessage[] = [{ role: 'user', content: userMsg }];
    const startVid = Date.now();
    const r = await callLLM(msgs, sys, topK, MAX_LLM_CALLS);
    const raw = r.text.trim().replace(/[^0-9]/g, '');
    const idx = Math.max(0, Math.min(parseInt(raw || '0'), options.length - 1));
    tallies[idx] = (tallies[idx] ?? 0) + 1;
    emit({ type: 'node_done', nodeId: vid, success: true, summary: `→ option ${idx}`, rawResponse: r.text, durationMs: Date.now() - startVid });
  }));

  const winner = Number(Object.entries(tallies).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0);
  emit({ type: 'node_done', nodeId: jid, success: true, summary: `Winner: #${winner} (${tallies[winner] ?? 0}/${size} votes)`, durationMs: Date.now() - startJid });
  return options[winner] ?? options[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// ERROR CORRECTION LOOP
// Triggered when analysis jury determines execution failed.
// 1. Error Finder Jury: vote on whether THIS node is the root cause
// 2. Recovery Consortium: generate alternative approaches
// 3. Recovery Jury: pick best recovery strategy
// 4. Re-run this RafNode with steering advice
// ─────────────────────────────────────────────────────────────────────────────

async function runErrorCorrection(
  context: string,
  params: RAFParams,
  depth: number,
  name: string,
  rafNodeId: string,
  parentRafId: string | undefined,
  failureSummary: string,
  previousAnswer: string,
  _depSummary: string | undefined,
): Promise<{ steeringAdvice: string; isOrigin: boolean }> {
  const isRoot = parentRafId === undefined;

  // Step 1: Error finder jury
  const efid = nid('jury');
  const efUserMsg = `Node name: ${name}\nDepth: ${depth}\nProblem: ${context?.slice(0, 400)}\nExecution result: ${previousAnswer?.slice(0, 300)}\nFailure analysis: ${failureSummary?.slice(0, 300)}\n\n${isRoot ? 'This is the ROOT node — answer YES.' : 'Is this node responsible for the failure?'}`;
  emit({ type: 'node_start', nodeId: efid, label: `Error Finder Jury (n=${params.errorFinderJurySize})`, nodeType: 'jury', parentId: rafNodeId, rafNodeId, edgeType: 'flow', prompt: efUserMsg, systemPrompt: SYS.errorFinderJury });
  const startEfid = Date.now();

  let yesVotes = 0;

  await Promise.all(Array.from({ length: params.errorFinderJurySize }, async (_, i) => {
    const vid = nid('agent');
    emit({ type: 'node_start', nodeId: vid, label: `EF Voter ${i + 1}`, nodeType: 'agent', parentId: efid, rafNodeId, edgeType: 'parallel', prompt: efUserMsg, systemPrompt: SYS.errorFinderJury });
    const startVid = Date.now();
    const r = isRoot
      ? { text: 'YES' }
      : await callLLM([{ role: 'user', content: efUserMsg }], SYS.errorFinderJury, params.minTopK, MAX_LLM_CALLS);
    const vote = r.text.trim().toUpperCase().startsWith('Y') ? 'YES' : 'NO';
    if (vote === 'YES') yesVotes++;
    emit({ type: 'node_done', nodeId: vid, success: true, summary: vote, rawResponse: r.text, durationMs: Date.now() - startVid });
  }));

  const isOrigin = isRoot || yesVotes > Math.floor(params.errorFinderJurySize / 2);
  emit({ type: 'node_done', nodeId: efid, success: true, summary: isOrigin ? `Origin: YES (${yesVotes}/${params.errorFinderJurySize})` : `Origin: NO (${yesVotes}/${params.errorFinderJurySize})`, durationMs: Date.now() - startEfid });

  if (!isOrigin) {
    return { steeringAdvice: '', isOrigin: false };
  }

  // Step 2: Recovery Consortium — generate alternative approaches
  type Recovery = { failure_analysis: string; new_approach: string; key_differences: string[]; confidence: string };
  const recoveryUserMsg = `FAILED PROBLEM: ${context?.slice(0, 600)}\n\nPREVIOUS APPROACH RESULT: ${previousAnswer?.slice(0, 400)}\n\nFAILURE REASON: ${failureSummary?.slice(0, 300)}\n\nPropose a completely different approach.`;

  const tryParseRecovery = (t: string): Recovery | null => {
    try { return JSON.parse(t.trim()); }
    catch { return null; }
  };

  const recoveries = await consortium<Recovery>(
    'Recovery Consortium', rafNodeId, rafNodeId,
    params.recoveryConsortiumSize, params.maxTopK,
    SYS.recoveryConsortium, () => recoveryUserMsg, tryParseRecovery,
  );

  const recoveryOpts = recoveries.length > 0 ? recoveries : [{
    failure_analysis: 'Unknown failure',
    new_approach: 'Try a step-by-step first-principles approach',
    key_differences: ['More systematic'],
    confidence: 'medium',
  }];

  // Step 3: Recovery Jury — pick best strategy
  const bestRecovery = await jury<Recovery>(
    'Recovery Jury', rafNodeId, rafNodeId,
    params.errorFinderJurySize, params.minTopK,
    recoveryOpts, SYS.recoveryJury,
    () => `Select best recovery:\n${recoveryOpts.map((r, i) => `[${i}] ${JSON.stringify(r)}`).join('\n')}`,
  );

  const steeringAdvice = `CORRECTION GUIDANCE (previous attempt failed):\nFailure: ${bestRecovery.failure_analysis}\nNew approach: ${bestRecovery.new_approach}\nKey differences: ${bestRecovery.key_differences.join('; ')}`;

  return { steeringAdvice, isOrigin: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN RAF NODE
// ─────────────────────────────────────────────────────────────────────────────

export interface RafResult {
  name: string;
  success: boolean;
  summary: string;
  answer?: string;
  retries: number;
  children: Record<string, RafResult>;
}

type Plan = { name: string; context: string; dependsOn: string[] };

export async function execRafNode(
  context: string,
  params: RAFParams,
  depth: number,
  name: string,
  parentRafId?: string,
  depSummaryIn?: string,
  steeringAdvice?: string,
  retryCount = 0,
): Promise<RafResult> {
  const rid = nid('raf');
  emit({ type: 'raf_node_start', rafNodeId: rid, parentRafNodeId: parentRafId, label: name, depth });

  const tk = Math.round((params.minTopK + params.maxTopK) / 2);

  // Build full context, incorporating dependency results and any steering advice
  let ctx = depSummaryIn ? `Context from upstream tasks:\n${depSummaryIn}\n\nCurrent task:\n${context}` : context;
  if (steeringAdvice) {
    ctx = `${steeringAdvice}\n\n---\n\nPROBLEM TO SOLVE:\n${ctx}`;
  }

  // ── Base Case Vote ────────────────────────────────────────────────────────
  const voteJuryId = nid('jury');
  const votePrompt = `Depth: ${depth}/${MAX_RECURSION_DEPTH}\n\nTask to classify:\n${ctx?.slice(0, 800)}`;
  emit({ type: 'node_start', nodeId: voteJuryId, label: `Base Case Jury (n=${params.baseCaseJurySize})`, nodeType: 'jury', parentId: rid, rafNodeId: rid, edgeType: 'flow', prompt: votePrompt, systemPrompt: SYS.baseCaseVote });

  const voteTallies: Record<string, number> = {};
  const startVoteJury = Date.now();
  await Promise.all(Array.from({ length: params.baseCaseJurySize }, async (_, i) => {
    const vid = nid('agent');
    emit({ type: 'node_start', nodeId: vid, label: `Voter ${i + 1}`, nodeType: 'agent', parentId: voteJuryId, rafNodeId: rid, edgeType: 'parallel', prompt: votePrompt, systemPrompt: SYS.baseCaseVote });
    const startVid = Date.now();
    const r = await callLLM(
      [{ role: 'user', content: votePrompt }],
      SYS.baseCaseVote, tk, MAX_LLM_CALLS,
    );
    const vote = r.text.toLowerCase().includes('base') ? 'Base Case' : 'Recursive Case';
    voteTallies[vote] = (voteTallies[vote] ?? 0) + 1;
    emit({ type: 'node_done', nodeId: vid, success: true, summary: vote, rawResponse: r.text, durationMs: Date.now() - startVid });
  }));

  // Force base case at max depth to prevent infinite recursion
  const isBase = depth >= MAX_RECURSION_DEPTH
    || (voteTallies['Base Case'] ?? 0) > (voteTallies['Recursive Case'] ?? 0);
  emit({ type: 'node_done', nodeId: voteJuryId, success: true, summary: isBase ? '→ Base Case' : '→ Recursive Case', durationMs: Date.now() - startVoteJury });
  emit({ type: 'raf_node_type', rafNodeId: rid, caseType: isBase ? 'base' : 'recursive' });

  if (isBase) {
    // ── BASE CASE ────────────────────────────────────────────────────────────
    type Design = { approach: string; key_operations: string[]; tools_needed: string[]; expected_output: string };

    const tryParseDesign = (t: string): Design | null => {
      try {
        const obj = JSON.parse(t.trim());
        return obj && obj.approach ? obj : null;
      } catch {
        return null;
      }
    };

    const designs = await consortium<Design>(
      'Design Consortium', rid, rid,
      params.baseCaseConsortiumSize, tk,
      SYS.designAgent, () => `Design a plan to solve:\n${ctx?.slice(0, 1000)}`,
      tryParseDesign,
    );
    const designOpts = designs.length > 0 ? designs : [{ approach: 'Direct step-by-step computation.', key_operations: [], tools_needed: [], expected_output: 'answer' }];

    const bestDesign = await jury<Design>(
      'Design Jury', rid, rid,
      params.baseCaseDesignJurySize, tk,
      designOpts, SYS.designJury,
      () => `Choose best plan:\n${designOpts.map((d, i) => `[${i}] ${JSON.stringify(d)}`).join('\n')}`,
    );

    // Execute
    const eid = nid('agent');
    const execPrompt = `Problem:\n${ctx?.slice(0, 1200)}\n\nApproach: ${bestDesign.approach}\nTools to use: ${bestDesign.tools_needed?.join(', ') || 'none'}\n\nSolve step by step:`;
    emit({ type: 'node_start', nodeId: eid, label: 'Execute', nodeType: 'agent', parentId: rid, rafNodeId: rid, edgeType: 'flow', prompt: execPrompt, systemPrompt: SYS.execute });
    const startEid = Date.now();
    const execR = await callLLM(
      [{ role: 'user', content: execPrompt }],
      SYS.execute, params.maxTopK, MAX_LLM_CALLS,
    );
    emit({ type: 'node_done', nodeId: eid, success: true, summary: execR.text?.slice(0, 100), rawResponse: execR.text, durationMs: Date.now() - startEid });

    const answerMatch = execR.text.match(/####\s*(.+)$/m);
    const answer = answerMatch?.[1]?.trim() ?? execR.text?.slice(-200).trim();

    // Analysis
    type Analysis = { success: boolean; info: string };
    const tryParseAnalysis = (t: string): Analysis | null => {
      try {
        const obj = JSON.parse(t.trim());
        return obj && typeof obj.success === 'boolean' ? obj : null;
      } catch { return null; }
    };

    const analyses = await consortium<Analysis>(
      'Analysis Consortium', rid, rid,
      params.analysisConsortiumSize, tk,
      SYS.analysisAgent,
      () => `Original task:\n${ctx?.slice(0, 600)}\n\nExecution result:\n${execR.text?.slice(0, 600)}`,
      tryParseAnalysis,
    );
    const anaOpts = analyses.length > 0 ? analyses : [{ success: true, info: `Answer: ${answer}` }];

    const finalAna = await jury<Analysis>(
      'Analysis Jury', rid, rid,
      params.analysisJurySize, tk,
      anaOpts, SYS.analysisJury,
      () => `Choose most accurate analysis:\n${anaOpts.map((a, i) => `[${i}] ${JSON.stringify(a)}`).join('\n')}`,
    );

    // ── Error Correction Loop ────────────────────────────────────────────────
    if (!finalAna.success) {
      const { steeringAdvice: newAdvice, isOrigin } = await runErrorCorrection(
        context, params, depth, name, rid, parentRafId,
        finalAna.info, answer, depSummaryIn,
      );

      if (isOrigin && newAdvice) {
        // Scrap and re-run with steering advice
        emit({ type: 'raf_node_done', rafNodeId: rid, success: false, summary: `Retrying with correction (attempt ${retryCount + 2})` });
        return execRafNode(context, params, depth, name, parentRafId, depSummaryIn, newAdvice, retryCount + 1);
      }

      // Not the origin — propagate failure up
      emit({ type: 'raf_node_done', rafNodeId: rid, success: false, summary: answer });
      return { name, success: false, summary: finalAna.info, answer, retries: retryCount, children: {} };
    }

    emit({ type: 'raf_node_done', rafNodeId: rid, success: true, summary: answer });
    return { name, success: true, summary: finalAna.info, answer, retries: retryCount, children: {} };

  } else {
    // ── RECURSIVE CASE ────────────────────────────────────────────────────────
    const tryParsePlan = (t: string): Plan[] | null => {
      try {
        const arr = JSON.parse(t.trim());
        return Array.isArray(arr) && arr.length >= 2 ? arr : null;
      } catch { return null; }
    };

    const plans = await consortium<Plan[]>(
      'Plan Consortium', rid, rid,
      params.planConsortiumSize, tk,
      SYS.planAgent, () => `Decompose into 2-4 sub-tasks:\n${ctx?.slice(0, 1000)}`,
      tryParsePlan,
    );

    const fallbackPlan: Plan[] = [
      { name: 'analyze-problem', context: ctx?.slice(0, 600), dependsOn: [] },
      { name: 'synthesize-answer', context: `Combine analysis results to answer: ${context?.slice(0, 400)}`, dependsOn: ['analyze-problem'] },
    ];
    const planOpts = plans.length > 0 ? plans : [fallbackPlan];

    const chosenPlan = await jury<Plan[]>(
      'Plan Jury', rid, rid,
      params.planJurySize, tk,
      planOpts, SYS.planJury,
      () => `Choose best decomposition:\n${planOpts.map((p, i) => `[${i}] ${JSON.stringify(p)?.slice(0, 400)}`).join('\n')}`,
    );

    // Execute children respecting dependsOn order
    const childResults: Record<string, RafResult> = {};
    const done = new Set<string>();
    const validDepNames = new Set(chosenPlan.map(p => p.name));

    const execChild = async (plan: Plan): Promise<void> => {
      // Wait for dependencies (only those that actually exist in the plan to prevent infinite hangs)
      const validDeps = (plan.dependsOn || []).filter(d => validDepNames.has(d));
      let waitLoops = 0;
      
      while (validDeps.some(d => !done.has(d)) && waitLoops < 300) {
        await new Promise(r => setTimeout(r, 100));
        waitLoops++;
      }
      
      const depCtx = (plan.dependsOn || []).map(d => childResults[d]?.summary ?? '').filter(Boolean).join('\n');
      childResults[plan.name] = await execRafNode(
        plan.context, params, depth + 1, plan.name, rid, depCtx || undefined,
      );
      done.add(plan.name);
    };

    await Promise.all(chosenPlan.map(execChild));

    const allSummaries = Object.entries(childResults)
      .map(([n, r]) => `${n}: ${r.answer ?? r.summary}`)
      .join('\n');

    // Analysis of recursive results
    type Analysis = { success: boolean; info: string };
    const tryParseAnalysis = (t: string): Analysis | null => {
      try {
        const obj = JSON.parse(t.trim());
        return obj && typeof obj.success === 'boolean' ? obj : null;
      } catch { return null; }
    };

    const allFailed = Object.values(childResults).some(r => !r.success);

    const analyses = await consortium<Analysis>(
      'Analysis Consortium', rid, rid,
      params.analysisConsortiumSize, tk,
      SYS.analysisAgent,
      () => `Original task:\n${ctx?.slice(0, 400)}\n\nSub-task results:\n${allSummaries}`,
      tryParseAnalysis,
    );
    const anaOpts = analyses.length > 0 ? analyses : [{ success: !allFailed, info: allSummaries }];

    const finalAna = await jury<Analysis>(
      'Analysis Jury', rid, rid,
      params.analysisJurySize, tk,
      anaOpts, SYS.analysisJury,
      () => `Choose most accurate analysis:\n${anaOpts.map((a, i) => `[${i}] ${JSON.stringify(a)}`).join('\n')}`,
    );

    const childAnswers = Object.values(childResults)
      .map(r => r.answer).filter(Boolean).join(' | ');

    // Error correction for recursive case
    if (!finalAna.success) {
      const { steeringAdvice: newAdvice, isOrigin } = await runErrorCorrection(
        context, params, depth, name, rid, parentRafId,
        finalAna.info, childAnswers, depSummaryIn,
      );

      if (isOrigin && newAdvice) {
        emit({ type: 'raf_node_done', rafNodeId: rid, success: false, summary: `Retrying with correction (attempt ${retryCount + 2})` });
        return execRafNode(context, params, depth, name, parentRafId, depSummaryIn, newAdvice, retryCount + 1);
      }

      emit({ type: 'raf_node_done', rafNodeId: rid, success: false, summary: finalAna.info });
      return { name, success: false, summary: finalAna.info, answer: childAnswers, retries: retryCount, children: childResults };
    }

    emit({ type: 'raf_node_done', rafNodeId: rid, success: true, summary: finalAna.info });
    return { name, success: true, summary: finalAna.info, answer: childAnswers || finalAna.info, retries: retryCount, children: childResults };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC ENTRY
// ─────────────────────────────────────────────────────────────────────────────

export function getJsonStats() { return { attempts: _jsonAttempts, successes: _jsonSuccesses }; }

export function runRAF(
  problem: string,
  params: RAFParams,
  onEvent: EventCb,
): Promise<RafResult> {
  _nid = 0;
  _jsonAttempts = 0;
  _jsonSuccesses = 0;
  _cb = onEvent;
  resetCallCount();
  setCallCountCallback(n => onEvent({ type: 'call_count', count: n }));
  return execRafNode(problem, params, 0, 'root');
}
