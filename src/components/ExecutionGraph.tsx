import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { GraphNode, GraphEdge, GraphMode, PhysicsParams } from '../engine/types';

const NC: Record<string, string> = {
  'raf-node': '#00e5ff', jury: '#e040fb', consortium: '#ffeb3b',
  agent: '#69ff47', analysis: '#ff9100', recovery: '#f43f5e',
};
const NR: Record<string, number> = {
  'raf-node': 20, jury: 15, consortium: 17, agent: 11, analysis: 15, recovery: 18,
};

interface Props {
  nodes: GraphNode[];
  links: GraphEdge[];
  mode: GraphMode;
  physics: PhysicsParams;
  width: number;
  height: number;
  onNodeClick?: (node: GraphNode) => void;
  onBackgroundClick?: () => void;
}

function forceConstantOutward(cx: number, cy: number, strength: number) {
  let nodes: GraphNode[];
  function force(alpha: number) {
    for (let i = 0, n = nodes.length; i < n; ++i) {
      const node = nodes[i];
      if (node.depth === 0) continue;
      const dx = (node.x ?? 0) - cx;
      const dy = (node.y ?? 0) - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      node.vx = (node.vx ?? 0) + (dx / dist) * strength * alpha;
      node.vy = (node.vy ?? 0) + (dy / dist) * strength * alpha;
    }
  }
  force.initialize = function(_nodes: GraphNode[]) {
    nodes = _nodes;
  };
  return force;
}

function forceProgressiveLink(baseDistance: number, strengthScale: number) {
  let nodes: GraphNode[];
  let links: GraphEdge[] = [];
  function force(alpha: number) {
    if (!nodes || !links.length) return;
    for (let i = 0, n = links.length; i < n; ++i) {
      const link = links[i];
      const source = typeof link.source === 'object' ? link.source : null;
      const target = typeof link.target === 'object' ? link.target : null;
      if (!source || !target) continue;

      const dx = (target.x ?? 0) - (source.x ?? 0);
      const dy = (target.y ?? 0) - (source.y ?? 0);
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      
      const stretch = Math.max(0, dist - baseDistance);
      if (stretch > 0) {
        // Clamp the maximum stretch to prevent physics explosions
        const safeStretch = Math.min(stretch, 500);
        // pull scales quadratically but is safely clamped
        const pull = safeStretch * safeStretch * strengthScale * alpha * 0.01;
        
        // Ensure pull doesn't go completely infinite just in case
        const clampedPull = Math.min(pull, 50);
        
        const pullX = (dx / dist) * clampedPull;
        const pullY = (dy / dist) * clampedPull;

        target.vx = (target.vx ?? 0) - pullX;
        target.vy = (target.vy ?? 0) - pullY;
        source.vx = (source.vx ?? 0) + pullX;
        source.vy = (source.vy ?? 0) + pullY;
      }
    }
  }
  force.initialize = function(_nodes: GraphNode[]) {
    nodes = _nodes;
  };
  force.links = function(_links: GraphEdge[]) {
    links = _links;
    return force;
  };
  return force;
}

export function ExecutionGraph({ nodes, links, mode, physics, width, height, onNodeClick, onBackgroundClick }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simRef = useRef<d3.Simulation<GraphNode, GraphEdge> | null>(null);
  const zlRef  = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const initRef    = useRef(false);
  const prevModeRef = useRef(mode);
  const prevCountRef = useRef(0);  // track node count to detect additions vs. full resets

  // ── Init SVG once ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!svgRef.current || initRef.current) return;
    initRef.current = true;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Glow filter
    const defs = svg.append('defs');
    const f = defs.append('filter').attr('id', 'glow');
    f.append('feGaussianBlur').attr('stdDeviation', 3).attr('result', 'blur');
    const fm = f.append('feMerge');
    fm.append('feMergeNode').attr('in', 'blur');
    fm.append('feMergeNode').attr('in', 'SourceGraphic');

    // Arrow markers
    (['flow', 'parallel', 'dependency'] as const).forEach(t => {
      const c = { flow: '#444', parallel: '#00cccc', dependency: '#e040fb' }[t];
      defs.append('marker').attr('id', `arr-${t}`)
        .attr('viewBox', '0 -5 10 10').attr('refX', 26).attr('refY', 0)
        .attr('markerWidth', 5).attr('markerHeight', 5).attr('orient', 'auto')
        .append('path').attr('d', 'M0,-5L10,0L0,5').attr('fill', c);
    });

    const zl = svg.append('g');
    zlRef.current = zl;

    // Zoom / pan
    svg.call(d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.08, 5])
      .on('zoom', e => zl.attr('transform', e.transform.toString()))
    );
    svg.on('click', () => onBackgroundClick?.());

    zl.append('g').attr('class', 'edges');
    zl.append('g').attr('class', 'nodes');
    zl.append('g').attr('class', 'labels');

    simRef.current = d3.forceSimulation<GraphNode>([])
      .force('link',    d3.forceLink<GraphNode, GraphEdge>([])
                          .id(d => d.id)
                          .distance(physics.linkDistance)
                          .strength(physics.linkStrength))
      .force('charge',  d3.forceManyBody().strength(physics.chargeStrength).distanceMax(physics.chargeDistanceMax))
      .force('outward', forceConstantOutward(width / 2, height / 2, physics.outwardStrength))
      .force('progressiveLink', forceProgressiveLink(physics.progressiveLinkBase, physics.progressiveLinkScale))
      .force('collide', d3.forceCollide<GraphNode>().radius(d => NR[d.type] + physics.collideRadiusOffset).strength(physics.collideStrength))
      .alphaDecay(physics.alphaDecay)
      .velocityDecay(physics.velocityDecay);

    simRef.current.on('tick', () => {
      if (!zlRef.current) return;
      const g = zlRef.current;
      g.select('.edges').selectAll<SVGLineElement, GraphEdge>('line')
        .attr('x1', d => (d.source as GraphNode).x ?? 0)
        .attr('y1', d => (d.source as GraphNode).y ?? 0)
        .attr('x2', d => (d.target as GraphNode).x ?? 0)
        .attr('y2', d => (d.target as GraphNode).y ?? 0);
      g.select('.nodes').selectAll<SVGGElement, GraphNode>('g.ngrp')
        .attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`);
      g.select('.labels').selectAll<SVGTextElement, GraphNode>('text')
        .attr('x', d => d.x ?? 0)
        .attr('y', d => (d.y ?? 0) + NR[d.type] + 12);
    });
  }, []); // eslint-disable-line

  // ── Update physics dynamically ──────────────────────────────────────────────
  useEffect(() => {
    if (!simRef.current) return;
    const sim = simRef.current;
    
    (sim.force('link') as d3.ForceLink<GraphNode, GraphEdge>)
      .distance(physics.linkDistance)
      .strength(physics.linkStrength);
      
    (sim.force('charge') as d3.ForceManyBody<GraphNode>)
      .strength(physics.chargeStrength)
      .distanceMax(physics.chargeDistanceMax);
      
    sim.force('outward', forceConstantOutward(width / 2, height / 2, physics.outwardStrength));
    
    const vLinks = (sim.force('link') as d3.ForceLink<GraphNode, GraphEdge>).links();
    sim.force('progressiveLink', forceProgressiveLink(physics.progressiveLinkBase, physics.progressiveLinkScale));
    const progForce = sim.force('progressiveLink') as any;
    if (progForce) progForce.links(vLinks);
    
    (sim.force('collide') as d3.ForceCollide<GraphNode>)
      .radius(d => NR[d.type] + physics.collideRadiusOffset)
      .strength(physics.collideStrength);
      
    sim.alphaDecay(physics.alphaDecay).velocityDecay(physics.velocityDecay);
    
    sim.alpha(Math.max(sim.alpha(), 0.3)).restart();
  }, [physics, width, height]);

  // ── Update graph data ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!simRef.current || !zlRef.current) return;
    const sim = simRef.current;
    const g   = zlRef.current;

    try {
      const modeChanged = prevModeRef.current !== mode;
      prevModeRef.current = mode;
      const isAddition = nodes.length > prevCountRef.current;
      prevCountRef.current = nodes.length;

      // ── Pin root node to graph center ────────
      // Root node (depth=0) is held at the center so the graph grows radially.
      // We don't pin after the run completes (when active=false) so the user
      // can drag it freely once the layout has settled.
      const cx = width  / 2;
      const cy = height / 2;
      nodes.forEach(n => {
        if (n.depth === 0) {
          n.fx = n.active ? cx : null;
          n.fy = n.active ? cy : null;
        }
      });

      const vNodes = mode === 'full' ? nodes : nodes.filter(n => n.type === 'raf-node');
      const vIds   = new Set(vNodes.map(n => n.id));
      const vLinks = mode === 'full' ? links : links.filter(l => {
        const s = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id;
        const t = typeof l.target === 'string' ? l.target : (l.target as GraphNode).id;
        return vIds.has(s) && vIds.has(t);
      });

      // Repair stale object references from localStorage or session switching.
      // If a link already has an object reference, but it's not the exact object
      // in vNodes (e.g. from a past session), we must point it to the current node.
      const nodeById = new Map(vNodes.map(n => [n.id, n]));
      vLinks.forEach(l => {
        if (typeof l.source === 'object') {
          const id = (l.source as GraphNode).id;
          const curr = nodeById.get(id);
          if (curr && curr !== l.source) l.source = curr;
        }
        if (typeof l.target === 'object') {
          const id = (l.target as GraphNode).id;
          const curr = nodeById.get(id);
          if (curr && curr !== l.target) l.target = curr;
        }
      });

      // ── D3 DOM update (enter / update / exit) ────────────────────────────
      const eSel = g.select<SVGGElement>('.edges').selectAll<SVGLineElement, GraphEdge>('line')
        .data(vLinks, d => d.id);
      eSel.exit().transition().duration(200).attr('opacity', 0).remove();
      eSel.enter().append('line').attr('opacity', 0).attr('stroke-linecap', 'round')
        .call(e => e.transition().duration(300).attr('opacity', 1))
        .merge(eSel)
        .attr('stroke', d => d.edgeType === 'parallel' ? '#00cccc' : d.edgeType === 'dependency' ? '#e040fb' : '#444')
        .attr('stroke-width',    d => d.edgeType === 'dependency' ? 1.5 : 2)
        .attr('stroke-dasharray', d => d.edgeType === 'parallel' ? '8 4' : d.edgeType === 'dependency' ? '3 3' : 'none')
        .attr('marker-end',      d => `url(#arr-${d.edgeType})`);

      const nSel = g.select<SVGGElement>('.nodes').selectAll<SVGGElement, GraphNode>('g.ngrp')
        .data(vNodes, d => d.id);
      nSel.exit().transition().duration(180).attr('opacity', 0).remove();

      const getNodeColor = (d: GraphNode) => {
        if (d.type === 'raf-node') {
          if (d.caseType === 'base') return '#69ff47'; // Green
          if (d.caseType === 'recursive') return '#f59e0b'; // Orange/Amber
        }
        return NC[d.type] ?? '#888';
      };

      const nEnter = nSel.enter().append('g')
        .attr('class', d => `ngrp ngrp-${d.type}`)
        .style('cursor', 'grab');
      nEnter.append('circle').attr('r', 0).attr('filter', 'url(#glow)')
        .attr('fill', getNodeColor)
        .attr('stroke', 'rgba(255,255,255,0.2)').attr('stroke-width', 1.5)
        .transition().duration(420).attr('r', d => NR[d.type]);

      const nMerge = nEnter.merge(nSel);
      nMerge.attr('class', d => `ngrp ngrp-${d.type}${d.active ? ' raf-node-active' : ''}`);
      nMerge.select('circle')
        .attr('fill', getNodeColor)
        .attr('opacity', d => d.active ? 1 : 0.75);

      nMerge
        .on('click', (e, d) => {
          onNodeClick?.(d);
          e.stopPropagation();
        })
        .on('mouseenter', function(_e, d) {
          d3.select(this).select('circle').transition().duration(100).attr('r', NR[d.type] * 1.35);
          d3.select(this).select('title').remove();
          d3.select(this).append('title').text(`${d.label}\n${d.detail}`);
        })
        .on('mouseleave', function(_e, d) {
          d3.select(this).select('circle').transition().duration(100).attr('r', NR[d.type]);
        });

      const drag = d3.drag<SVGGElement, GraphNode>()
        .on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag',  (e, d) => { d.fx = e.x; d.fy = e.y; })
        .on('end',   (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; });
      nMerge.call(drag);

      const lSel = g.select<SVGGElement>('.labels').selectAll<SVGTextElement, GraphNode>('text')
        .data(vNodes, d => d.id);
      lSel.exit().remove();
      lSel.enter().append('text')
        .attr('text-anchor', 'middle').attr('font-size', 9)
        .attr('fill', '#888').attr('pointer-events', 'none')
        .merge(lSel)
        .text(d => (d.label && d.label.length > 16) ? d.label.slice(0, 15) + '…' : (d.label || ''));

      // ── Simulation update ────────────────────────────────────────────────
      // CRITICAL ORDER: nodes first so D3 builds nodeById before links resolve.
      sim.nodes(vNodes);
      (sim.force('link') as d3.ForceLink<GraphNode, GraphEdge>).links(vLinks);
      const progForce = sim.force('progressiveLink') as any;
      if (progForce) progForce.links(vLinks);

      // Use moderate alpha for mode changes, low for pure status updates.
      // Prevent alpha explosion: only boost alpha if it's currently lower than target.
      const targetAlpha = modeChanged ? 0.7 : isAddition ? 0.3 : 0.1;
      sim.alpha(Math.max(sim.alpha(), targetAlpha)).restart();

    } catch (err) {
      console.error('[ExecutionGraph] D3 update error (suppressed):', err);
    }
  }, [nodes, links, mode, width, height]);

  // ── Cleanup ─────────────────────────────────────────────────────────────────
  useEffect(() => () => {
    simRef.current?.stop();
    simRef.current = null;
    initRef.current   = false;
    prevCountRef.current = 0;
  }, []);

  return <svg ref={svgRef} style={{ width: '100%', height: '100%', background: 'hsl(222 47% 3%)' }} />;
}