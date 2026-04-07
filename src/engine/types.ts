export type NodeType = 'raf-node' | 'jury' | 'consortium' | 'agent' | 'analysis';
export type GraphMode = 'full' | 'simplified';

export interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  detail: string;
  active: boolean;
  success?: boolean;
  rafNodeId?: string;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  vx?: number;
  vy?: number;
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
  | { type: 'raf_node_done'; rafNodeId: string; success: boolean; summary?: string };

export interface RAFParams {
  baseCaseJurySize: number;
  baseCaseConsortiumSize: number;
  baseCaseDesignJurySize: number;
  analysisConsortiumSize: number;
  analysisJurySize: number;
  planConsortiumSize: number;
  planJurySize: number;
  minTopK: number;
  maxTopK: number;
  maxDepth: number;
  extraContextLayer: boolean;
  simulationMode: boolean;
}

export const DEFAULT_PARAMS: RAFParams = {
  baseCaseJurySize: 3,
  baseCaseConsortiumSize: 2,
  baseCaseDesignJurySize: 2,
  analysisConsortiumSize: 2,
  analysisJurySize: 2,
  planConsortiumSize: 2,
  planJurySize: 2,
  minTopK: 2,
  maxTopK: 8,
  maxDepth: 1,
  extraContextLayer: false,
  simulationMode: true,
};
