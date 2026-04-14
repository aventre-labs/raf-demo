export type NodeType = 'raf-node' | 'jury' | 'consortium' | 'agent' | 'recovery';
export type GraphMode = 'full' | 'simplified';

export interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  detail: string;
  active: boolean;
  success?: boolean;
  rafNodeId?: string;
  depth?: number;   // raf depth level — used to pin root node to center
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  vx?: number;
  vy?: number;
  caseType?: 'base' | 'recursive';
}

export interface GraphEdge {
  id: string;
  source: string | GraphNode;
  target: string | GraphNode;
  edgeType: 'flow' | 'parallel' | 'dependency';
}

export type ExecutionEvent =
  | { type: 'node_start'; nodeId: string; label: string; nodeType: NodeType; parentId?: string; rafNodeId?: string; edgeType?: 'flow' | 'parallel' | 'dependency' }
  | { type: 'node_done'; nodeId: string; success: boolean; summary?: string }
  | { type: 'raf_node_start'; rafNodeId: string; parentRafNodeId?: string; label: string; depth: number }
  | { type: 'raf_node_type'; rafNodeId: string; caseType: 'base' | 'recursive' }
  | { type: 'raf_node_done'; rafNodeId: string; success: boolean; summary?: string }
  | { type: 'call_count'; count: number }
  | { type: 'json_stats'; attempts: number; successes: number };

export interface RAFParams {
  baseCaseJurySize: number;
  baseCaseConsortiumSize: number;
  baseCaseDesignJurySize: number;
  analysisConsortiumSize: number;
  analysisJurySize: number;
  planConsortiumSize: number;
  planJurySize: number;
  errorFinderJurySize: number;
  recoveryConsortiumSize: number;
  minTopK: number;
  maxTopK: number;
  extraContextLayer: boolean;
}

export const DEFAULT_PARAMS: RAFParams = {
  baseCaseJurySize: 3,
  baseCaseConsortiumSize: 3,
  baseCaseDesignJurySize: 3,
  analysisConsortiumSize: 3,
  analysisJurySize: 3,
  planConsortiumSize: 3,
  planJurySize: 3,
  errorFinderJurySize: 3,
  recoveryConsortiumSize: 3,
  minTopK: 4,
  maxTopK: 8,
  extraContextLayer: false,
};

export const MAX_LLM_CALLS = 20000;
export const MAX_RECURSION_DEPTH = 500;
