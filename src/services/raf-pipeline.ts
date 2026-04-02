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

function answerKey(answer: number | string | null): string | null {
  if (answer === null) return null;
  if (typeof answer === 'number') return String(Math.round(answer * 100) / 100);
  return answer.trim().toLowerCase();
}

function majorityVote(
  voters: Array<{ answer: number | string | null }>,
): { finalAnswer: number | string | null; confidence: number } {
  const counts = new Map<string, { count: number; original: number | string | null }>();
  voters.forEach((voter) => {
    const key = answerKey(voter.answer);
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
): { finalAnswer: number | string | null; confidence: number } {
  // Weighted: same as majority but weight by frequency ratio
  return majorityVote(voters);
}

function unanimousVote(
  voters: Array<{ answer: number | string | null }>,
): { finalAnswer: number | string | null; confidence: number } {
  const keys = voters.map((v) => answerKey(v.answer));
  const allSame = keys.every((k) => k !== null && k === keys[0]);
  if (allSame && keys[0] !== null) {
    return { finalAnswer: voters[0].answer, confidence: voters.length };
  }
  // Fall back to majority if not unanimous
  return majorityVote(voters);
}

export async function runRAFPipeline(
  problem: string,
  onStageChange: (stage: string, data?: unknown) => void,
  params: RAFParams = DEFAULT_PARAMS,
): Promise<RAFResult> {
  onStageChange('problem_loaded', { problem });
  onStageChange('decomposing');

  const depthInstruction = params.decompositionDepth
    ? `Break the problem into exactly ${params.decompositionDepth} numbered sub-steps (or fewer if the problem is simpler).`
    : 'Break the problem into numbered sub-steps.';

  const decomp = await chatJimmy(
    [{ role: 'user', content: `${depthInstruction}\n\nProblem:\n${problem}` }],
    {
      systemPrompt:
        'You are a math tutor. Break down problems into clear numbered steps. Do NOT solve the problem yet — just identify the reasoning path.',
      topK: params.decompTopK,
    },
  );

  const steps = decomp.text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^\d+[.)]/.test(line))
    .slice(0, params.decompositionDepth);

  onStageChange('decomposed', { steps, raw: decomp.text });
  onStageChange('voting');

  const solvePrompt = {
    messages: [
      {
        role: 'user',
        content: `Problem: ${problem}\n\nApproach (use these steps):\n${decomp.text}\n\nNow solve carefully, showing each calculation. End with #### <your final answer>`,
      },
    ],
    options: {
      systemPrompt:
        'You are a careful problem solver. Use the decomposition, solve step by step, and always end with #### <answer>.',
      topK: params.solveTopK,
    },
  };

  const voterCount = Math.max(1, Math.min(7, params.numVoters));

  // Update graph voter nodes to reflect actual count
  const voterColors = ['#f97316', '#22c55e', '#06b6d4', '#a855f7', '#ec4899', '#facc15', '#14b8a6'];

  const voters = await Promise.all(
    Array.from({ length: voterCount }, async (_, index) => {
      // Notify graph to add voter node if not already present
      onStageChange('voter_start', { index, color: voterColors[index % voterColors.length], total: voterCount });
      const response = await chatJimmy(solvePrompt.messages, solvePrompt.options);
      const answer = parseAnswer(response.text);
      onStageChange('voter_done', { index, answer, response: response.text });
      return { response: response.text, answer, stats: response.stats };
    }),
  );

  let finalAnswer: number | string | null;
  let confidence: number;

  switch (params.votingStrategy) {
    case 'unanimous':
      ({ finalAnswer, confidence } = unanimousVote(voters));
      break;
    case 'weighted':
      ({ finalAnswer, confidence } = weightedVote(voters));
      break;
    default:
      ({ finalAnswer, confidence } = majorityVote(voters));
  }

  onStageChange('complete', { finalAnswer, confidence });

  return {
    decomposition: { steps, raw: decomp.text, stats: decomp.stats },
    voters,
    finalAnswer,
    confidence,
    totalTime: [decomp.stats, ...voters.map((v) => v.stats)].reduce((sum, stat) => sum + (stat?.total_time ?? 0), 0),
    totalTokens: [decomp.stats, ...voters.map((v) => v.stats)].reduce((sum, stat) => sum + (stat?.total_tokens ?? 0), 0),
  };
}
