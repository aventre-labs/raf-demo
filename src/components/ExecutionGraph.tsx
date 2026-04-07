import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { GraphNode, GraphEdge, GraphMode } from '../engine/types';

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
  width: number;
  height: number;
}

export function ExecutionGraph({ nodes, links, mode, width, height }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simRef = useRef<d3.Simulation<GraphNode, GraphEdge> | null>(null);
  const zlRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const initRef = useRef(false);
  const prevModeRef = useRef(mode);

  // Init SVG once
  useEffect(() => {
    if (!svgRef.current || initRef.current) return;
    initRef.current = true;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const defs = svg.append('defs');
    const f = defs.append('filter').attr('id', 'glow');
    f.append('feGaussianBlur').attr('stdDeviation', 3).attr('result', 'blur');
    const fm = f.append('feMerge');
    fm.append('feMergeNode').attr('in', 'blur');
    fm.append('feMergeNode').attr('in', 'SourceGraphic');

    (['flow', 'parallel', 'dependency'] as const).forEach(t => {
      const c = { flow: '#444', parallel: '#00cccc', dependency: '#e040fb' }[t];
      defs.append('marker').attr('id', `arr-${t}`)
        .attr('viewBox', '0 -5 10 10').attr('refX', 26).attr('refY', 0)
        .attr('markerWidth', 5).attr('markerHeight', 5).attr('orient', 'auto')
        .append('path').attr('d', 'M0,-5L10,0L0,5').attr('fill', c);
    });

    const zl = svg.append('g');
    zlRef.current = zl;

    svg.call(d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 4])
      .on('zoom', e => zl.attr('transform', e.transform.toString()))
    );

    zl.append('g').attr('class', 'edges');
    zl.append('g').attr('class', 'nodes');
    zl.append('g').attr('class', 'labels');

    simRef.current = d3.forceSimulation<GraphNode>([])
      .force('link', d3.forceLink<GraphNode, GraphEdge>([]).id(d => d.id).distance(75).strength(0.35))
      .force('charge', d3.forceManyBody().strength(-180).distanceMax(280))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide<GraphNode>().radius(d => NR[d.type] + 12).strength(0.8))
      .alphaDecay(0.028).velocityDecay(0.4);

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

  // Update graph data
  useEffect(() => {
    if (!simRef.current || !zlRef.current) return;
    const sim = simRef.current;
    const g = zlRef.current;
    const modeChanged = prevModeRef.current !== mode;
    prevModeRef.current = mode;

    const vNodes = mode === 'full' ? nodes : nodes.filter(n => n.type === 'raf-node');
    const vIds = new Set(vNodes.map(n => n.id));
    const vLinks = mode === 'full' ? links : links.filter(l => {
      const s = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id;
      const t = typeof l.target === 'string' ? l.target : (l.target as GraphNode).id;
      return vIds.has(s) && vIds.has(t);
    });

    const eSel = g.select<SVGGElement>('.edges').selectAll<SVGLineElement, GraphEdge>('line')
      .data(vLinks, d => d.id);
    eSel.exit().transition().duration(250).attr('opacity', 0).remove();
    const eEnter = eSel.enter().append('line').attr('opacity', 0).attr('stroke-linecap', 'round');
    eEnter.merge(eSel).transition().duration(300).attr('opacity', 1)
      .attr('stroke', d => d.edgeType === 'parallel' ? '#00cccc' : d.edgeType === 'dependency' ? '#e040fb' : '#444')
      .attr('stroke-width', d => d.edgeType === 'dependency' ? 1.5 : 2)
      .attr('stroke-dasharray', d => d.edgeType === 'parallel' ? '8 4' : d.edgeType === 'dependency' ? '3 3' : 'none')
      .attr('marker-end', d => `url(#arr-${d.edgeType})`);

    const nSel = g.select<SVGGElement>('.nodes').selectAll<SVGGElement, GraphNode>('g.ngrp')
      .data(vNodes, d => d.id);
    nSel.exit().transition().duration(200).attr('opacity', 0).remove();

    const nEnter = nSel.enter().append('g').attr('class', d => `ngrp ngrp-${d.type}`)
      .style('cursor', 'grab');
    nEnter.append('circle').attr('r', 0).attr('filter', 'url(#glow)')
      .attr('fill', d => NC[d.type] ?? '#888').attr('stroke', 'rgba(255,255,255,0.2)').attr('stroke-width', 1.5)
      .transition().duration(400).attr('r', d => NR[d.type]);

    const nMerge = nEnter.merge(nSel);
    nMerge.attr('class', d => `ngrp ngrp-${d.type}${d.active ? ' raf-node-active' : ''}`);
    nMerge.select('circle')
      .attr('fill', d => NC[d.type] ?? '#888')
      .attr('opacity', d => d.active ? 1 : 0.75);

    nMerge.on('mouseenter', function(_event, d) {
      d3.select(this).select('circle').transition().duration(100).attr('r', NR[d.type] * 1.35);
      d3.select(this).select('title').remove();
      d3.select(this).append('title').text(`${d.label}\n${d.detail}`);
    }).on('mouseleave', function(_event, d) {
      d3.select(this).select('circle').transition().duration(100).attr('r', NR[d.type]);
    });

    const drag = d3.drag<SVGGElement, GraphNode>()
      .on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
      .on('end', (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; });
    nMerge.call(drag);

    const lSel = g.select<SVGGElement>('.labels').selectAll<SVGTextElement, GraphNode>('text')
      .data(vNodes, d => d.id);
    lSel.exit().remove();
    lSel.enter().append('text').attr('text-anchor', 'middle').attr('font-size', 9)
      .attr('fill', '#888').attr('pointer-events', 'none').merge(lSel)
      .text(d => d.label.length > 16 ? d.label.slice(0, 15) + '…' : d.label);

    (sim.force('link') as d3.ForceLink<GraphNode, GraphEdge>).links(vLinks);
    sim.nodes(vNodes);
    sim.alpha(modeChanged ? 0.6 : 0.3).restart();
  }, [nodes, links, mode, width, height]);

  useEffect(() => () => {
    simRef.current?.stop();
    simRef.current = null;
    initRef.current = false;
  }, []);

  return <svg ref={svgRef} style={{ width: '100%', height: '100%', background: 'hsl(222 47% 3%)' }} />;
}
