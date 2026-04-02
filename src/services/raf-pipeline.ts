import { chatJimmy, type InferenceStats } from './chatjimmy';
import type { RAFParams } from '../components/ParameterPanel';
import { DEFAULT_PARAMS } from '../components/ParameterPanel';

export interface RAFResult {
  decomposition: { steps: string[]; raw: string; stats: InferenceStats | null };
  voters: Array<{ response: string; answer: number | string | null; stats: InferenceStats | null }>;
  finalAnswer: number | string | null;
  confidence: number;
  totalTime: number;
  totalTokens: number;
}

function parseAnswer(text: string): number | string | null {
  const numericMatch = text.match(/####\s*([\d,.-]+)/);
  if (numericMatch) return parseFloat(numericMatch[1].replace(/,/g, ''));

  const stringMatch = text.match(/####\s*(.+)$/m);
  if (stringMatch) return stringMatch[1].trim();

  if (text.includes('def ')) return text.trim();
  return null;
}

function answerKey(
  answer: number | string | null,
  tolerance: number,
): string | null {
  if (answer === null) return null;
  if (typeof answer === 'number') {
    // bucket by tolerance so close numbers group together
    if (tolerance > 0) {
      return String(Math.round(answer / tolerance) * tolerance);
    }
    return String(Math.round(answer * 100) / 100);
  }
  return answer.trim().toLowerCase();
}

function majorityVote(
  voters: Array<{ answer: number | string | null }>,
  tolerance = 0.5,
): { finalAnswer: number | string | null; confidence: number } {
  const counts = new Map<string, { count: number; original: number | string | null }>();
  voters.forEach((voter) => {
    const key = answerKey(voter.answer, tolerance);
    if (!key) return;
    const current = counts.get(key);
    counts.set(key, {
      count: (current?.count ?? 0) + 1,
      original: current?.original ?? voter.answer,
    });
  });

  let finalAnswer: number | string | null = null;
  let confidence = 0;
  counts.forEach((value) => {
    if (value.count > confidence) {
      confidence = value.count;
      finalAnswer = value.original;
    }
  });
  return { finalAnswer, confidence };
}

function weightedVote(
  voters: Array<{ answer: number | string | null }>,
  tolerance = 0.5,
): { finalAnswer: number | string | null; confidence: number } {
  // Same as majority for now (weights would require additional scoring)
  return majorityVote(voters, tolerance);
}

function unanimousVote(
  voters: Array<{ answer: number | string | null }>,
  tolerance = 0.5,
): { finalAnswer: number | string | null; confidence: number } {
  const keys = voters.map((v) => answerKey(v.answer, tolerance));
  const allSame = keys.every((k) => k !== null && k === keys[0]);
  if (allSame && keys[0] !== null) {
    return { finalAnswer: voters[0].answer, confidence: voters.length };
  }
  return majorityVote(voters, tolerance);
}

function rankedVote(
  voters: Array<{ answer: number | string | null }>,
  tolerance = 0.5,
): { finalAnswer: number | string | null; confidence: number } {
  // Ranked = majority with tolerance grouping (same effective impl for now)
  return majorityVote(voters, tolerance);
}

function applyTieBreaking(
  tied: Array<{ answer: number | string | null }>,
  strategy: 'first' | 'random' | 'rerun',
): number | string | null {
  if (strategy === 'random') {
    return tied[Math.floor(Math.random() * tied.length)].answer;
  }
  // 'first' and 'rerun' fall back to first response
  return tied[0]?.answer ?? null;
}

export async function runRAFPipeline(
  problem: string,
  onStageChange: (stage: string, data?: unknown) => void,
  params: RAFParams = DEFAULT_PARAMS,
): Promise<RAFResult> {
  const { decomposer, solver, validator, aggregator } = params;

  onStageChange('problem_loaded', { problem });
  onStageChange('decomposing');

  const depthInstruction =
    decomposer.depth === 'auto'
      ? 'Break the problem into numbered sub-steps.'
      : `Break the problem into exactly ${decomposer.depth} numbered sub-steps (or fewer if the problem is simpler).`;

  const decomp = await chatJimmy(
    [{ role: 'user', content: `${depthInstruction}\n\nProblem:\n${problem}` }],
    {
      systemPrompt:
        'You are a math tutor. Break down problems into clear numbered steps. Do NOT solve the problem yet — just identify the reasoning path.',
      topK: decomposer.topK,
      temperature: decomposer.temperature,
      max_tokens: decomposer.maxTokens,
    },
  );

  const maxSteps = decomposer.depth === 'auto' ? 10 : Number(decomposer.depth);
  const steps = decomp.text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^\d+[.)]/.test(line))
    .slice(0, maxSteps);

  onStageChange('decomposed', { steps, raw: decomp.text });
  onStageChange('voting');

  const solveMessages = [
    {
      role: 'user',
      content: `Problem: ${problem}\n\nApproach (use these steps):\n${decomp.text}\n\nNow solve carefully, showing each calculation. End with #### <your final answer>`,
    },
  ];
  const solveOptions = {
    systemPrompt:
      'You are a careful problem solver. Use the decomposition, solve step by step, and always end with #### <answer>.',
    topK: solver.topK,
    temperature: solver.temperature,
    max_tokens: solver.maxTokens,
  };

  const voterCount = Math.max(1, Math.min(9, solver.numVoters));
  const voterColors = ['#f97316', '#22c55e', '#06b6d4', '#a855f7', '#ec4899', '#facc15', '#14b8a6'];

  const rawVoters = await Promise.all(
    Array.from({ length: voterCount }, async (_, index) => {
      onStageChange('voter_start', { index, color: voterColors[index % voterColors.length], total: voterCount });

      // Use different seeds per voter when independentSeeds is on
      const opts = solver.independentSeeds
        ? { ...solveOptions, seed: 1000 + index * 37 }
        : solveOptions;

      const response = await chatJimmy(solveMessages, opts);
      const answer = parseAnswer(response.text);
      onStageChange('voter_done', { index, answer, response: response.text });
      return { response: response.text, answer, stats: response.stats };
    }),
  );

  // ── Validator pass ────────────────────────────────────────────────────────
  let validatedVoters = rawVoters;
  if (validator.enabled) {
    validatedVoters = rawVoters.map((voter) => {
      if (validator.rejectNonNumeric && typeof voter.answer !== 'number') {
        return { ...voter, answer: null };
      }
      return voter;
    });

    // For high strictness, also null out answers that seem like parse errors
    if (validator.strictness === 'high') {
      validatedVoters = validatedVoters.map((voter) => {
        if (
          voter.answer !== null &&
          typeof voter.answer === 'number' &&
          !isFinite(voter.answer)
        ) {
          return { ...voter, answer: null };
        }
        return voter;
      });
    }
  }

  // ── Aggregator ────────────────────────────────────────────────────────────
  const tol = aggregator.groupingTolerance;

  let voteResult: { finalAnswer: number | string | null; confidence: number };
  switch (aggregator.votingStrategy) {
    case 'unanimous':
      voteResult = unanimousVote(validatedVoters, tol);
      break;
    case 'weighted':
      voteResult = weightedVote(validatedVoters, tol);
      break;
    case 'ranked':
      voteResult = rankedVote(validatedVoters, tol);
      break;
    default:
      voteResult = majorityVote(validatedVoters, tol);
  }

  // Tie-breaking: if confidence === 1 and multiple answers exist, apply tie-break
  let { finalAnswer, confidence } = voteResult;
  if (confidence === 1 && aggregator.tieBreaking !== 'first') {
    finalAnswer = applyTieBreaking(validatedVoters, aggregator.tieBreaking);
  }

  onStageChange('complete', { finalAnswer, confidence });

  return {
    decomposition: { steps, raw: decomp.text, stats: decomp.stats },
    voters: rawVoters,
    finalAnswer,
    confidence,
    totalTime: [decomp.stats, ...rawVoters.map((v) => v.stats)].reduce(
      (sum, stat) => sum + (stat?.total_time ?? 0),
      0,
    ),
    totalTokens: [decomp.stats, ...rawVoters.map((v) => v.stats)].reduce(
      (sum, stat) => sum + (stat?.total_tokens ?? 0),
      0,
    ),
  };
}
