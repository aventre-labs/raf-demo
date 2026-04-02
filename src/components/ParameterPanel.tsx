import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, RotateCcw } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DecomposerParams {
  temperature: number;
  topK: number;
  depth: number | 'auto';
  maxTokens: number;
}

export interface SolverParams {
  numVoters: number;
  temperature: number;
  topK: number;
  maxTokens: number;
  independentSeeds: boolean;
}

export interface ValidatorParams {
  enabled: boolean;
  numericTolerance: number;
  strictness: 'low' | 'medium' | 'high';
  rejectNonNumeric: boolean;
}

export interface AggregatorParams {
  groupingTolerance: number;
  votingStrategy: 'majority' | 'weighted' | 'unanimous' | 'ranked';
  tieBreaking: 'first' | 'random' | 'rerun';
  consensusThreshold: 'simple' | 'supermajority';
}

export interface RAFParams {
  decomposer: DecomposerParams;
  solver: SolverParams;
  validator: ValidatorParams;
  aggregator: AggregatorParams;
}

export const DEFAULT_PARAMS: RAFParams = {
  decomposer: {
    temperature: 0.2,
    topK: 2,
    depth: 'auto',
    maxTokens: 256,
  },
  solver: {
    numVoters: 3,
    temperature: 0.7,
    topK: 4,
    maxTokens: 512,
    independentSeeds: true,
  },
  validator: {
    enabled: true,
    numericTolerance: 0.5,
    strictness: 'medium',
    rejectNonNumeric: true,
  },
  aggregator: {
    groupingTolerance: 0.5,
    votingStrategy: 'majority',
    tieBreaking: 'first',
    consensusThreshold: 'simple',
  },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

interface Props {
  params: RAFParams;
  onChange: (params: RAFParams) => void;
  disabled?: boolean;
}

const ease = [0.25, 0.46, 0.45, 0.94] as const;

function isDefault(params: RAFParams): boolean {
  return JSON.stringify(params) === JSON.stringify(DEFAULT_PARAMS);
}

// ─── Slider ─────────────────────────────────────────────────────────────────

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  disabled,
  unit,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  unit?: string;
  format?: (v: number) => string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  const display = format ? format(value) : `${value}${unit ?? ''}`;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-[#9ca3af] uppercase tracking-[0.16em]">{label}</label>
        <span className="font-['Space_Grotesk'] text-sm font-semibold text-white">{display}</span>
      </div>
      <div className="relative h-5 flex items-center">
        <div className="relative w-full h-1.5 rounded-full bg-white/10">
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6]"
            style={{ width: `${pct}%` }}
          />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />
        <div
          className="absolute h-4 w-4 rounded-full border-2 border-[#3b82f6] bg-[#0a0f1a] shadow-[0_0_8px_rgba(59,130,246,0.5)] pointer-events-none"
          style={{ left: `calc(${pct}% - 8px)` }}
        />
      </div>
    </div>
  );
}

// ─── Toggle ─────────────────────────────────────────────────────────────────

function Toggle({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium text-[#9ca3af] uppercase tracking-[0.16em]">{label}</span>
      <button
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition-colors ${checked ? 'bg-[#3b82f6]' : 'bg-white/15'} disabled:cursor-not-allowed`}
      >
        <span
          className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'left-6' : 'left-1'}`}
        />
      </button>
    </div>
  );
}

// ─── SegmentedControl ────────────────────────────────────────────────────────

function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-[#9ca3af] uppercase tracking-[0.16em]">{label}</div>
      <div className="flex gap-1 rounded-2xl bg-white/[0.04] p-1">
        {options.map((opt) => (
          <button
            key={opt.id}
            disabled={disabled}
            onClick={() => onChange(opt.id)}
            className={`flex-1 rounded-[10px] py-1.5 text-xs font-medium transition-all ${
              value === opt.id
                ? 'bg-white/12 text-white shadow-sm'
                : 'text-[#6b7280] hover:text-[#9ca3af]'
            } disabled:cursor-not-allowed`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── ClusterSection ──────────────────────────────────────────────────────────

function ClusterSection({
  icon,
  title,
  accentColor,
  summary,
  children,
  defaultOpen = false,
  headerExtra,
}: {
  icon: string;
  title: string;
  accentColor: string;
  summary: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  headerExtra?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-[20px] border border-white/8 bg-white/[0.02] overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-lg leading-none">{icon}</span>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white">{title}</div>
            <div className="mt-0.5 text-xs text-[#6b7280] truncate">{summary}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {headerExtra}
          <ChevronDown
            className={`h-4 w-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            style={{ color: accentColor }}
          />
        </div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/6 p-4 space-y-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Panel ──────────────────────────────────────────────────────────────

export default function ParameterPanel({ params, onChange, disabled }: Props) {
  const setDecomp = (patch: Partial<DecomposerParams>) =>
    onChange({ ...params, decomposer: { ...params.decomposer, ...patch } });
  const setSolver = (patch: Partial<SolverParams>) =>
    onChange({ ...params, solver: { ...params.solver, ...patch } });
  const setValidator = (patch: Partial<ValidatorParams>) =>
    onChange({ ...params, validator: { ...params.validator, ...patch } });
  const setAggregator = (patch: Partial<AggregatorParams>) =>
    onChange({ ...params, aggregator: { ...params.aggregator, ...patch } });

  const defaults = isDefault(params);

  const { decomposer, solver, validator, aggregator } = params;

  return (
    <div className="rounded-[24px] border border-white/8 bg-[#0d1524] overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/6">
        <div className="flex items-center gap-2 text-xs text-[#9ca3af]">
          <span className="font-semibold text-white">4 clusters</span>
          <span>·</span>
          <span>{solver.numVoters} solver agents</span>
          <span>·</span>
          <span className="capitalize">{aggregator.votingStrategy} vote</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-xl border border-[#10b981]/25 bg-[#10b981]/10 px-2.5 py-1">
            <div className="h-1.5 w-1.5 rounded-full bg-[#10b981] animate-pulse" />
            <span className="text-xs text-[#6ee7b7] font-medium">Llama 3.1 8B</span>
          </div>
          <motion.button
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.97 }}
            disabled={defaults || disabled}
            onClick={() => onChange({ ...DEFAULT_PARAMS })}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-1.5 text-xs font-medium text-[#9ca3af] hover:border-white/20 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <RotateCcw className="h-3 w-3" />
            Auto (Paper Defaults)
          </motion.button>
        </div>
      </div>

      {/* Cluster sections */}
      <div className="p-3 space-y-2">
        {/* 1. Decomposer */}
        <ClusterSection
          icon="🧩"
          title="Decomposer"
          accentColor="#8b5cf6"
          summary={`Temp ${decomposer.temperature} · TopK ${decomposer.topK} · Depth ${decomposer.depth} · ${decomposer.maxTokens} tok`}
          defaultOpen
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Slider
              label="Temperature"
              value={decomposer.temperature}
              min={0}
              max={1}
              step={0.1}
              onChange={(v) => setDecomp({ temperature: v })}
              disabled={disabled}
            />
            <Slider
              label="Top-K"
              value={decomposer.topK}
              min={1}
              max={50}
              onChange={(v) => setDecomp({ topK: v })}
              disabled={disabled}
            />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-[#9ca3af] uppercase tracking-[0.16em]">Decomp Depth</label>
                <span className="font-['Space_Grotesk'] text-sm font-semibold text-white">
                  {decomposer.depth === 'auto' ? 'Auto' : decomposer.depth}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  disabled={disabled}
                  onClick={() => setDecomp({ depth: 'auto' })}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition-all ${
                    decomposer.depth === 'auto'
                      ? 'border-[#8b5cf6]/50 bg-[#8b5cf6]/15 text-[#c4b5fd]'
                      : 'border-white/10 text-[#9ca3af] hover:border-white/20'
                  } disabled:cursor-not-allowed`}
                >
                  Auto
                </button>
                <div className="relative flex-1 h-8 flex items-center">
                  <div className="relative w-full h-1.5 rounded-full bg-white/10">
                    <div
                      className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6]"
                      style={{ width: decomposer.depth === 'auto' ? '0%' : `${((Number(decomposer.depth) - 2) / 8) * 100}%` }}
                    />
                  </div>
                  <input
                    type="range"
                    min={2}
                    max={10}
                    step={1}
                    value={decomposer.depth === 'auto' ? 5 : Number(decomposer.depth)}
                    disabled={disabled}
                    onChange={(e) => setDecomp({ depth: Number(e.target.value) })}
                    className="absolute inset-0 w-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                  />
                  <div
                    className="absolute h-4 w-4 rounded-full border-2 border-[#3b82f6] bg-[#0a0f1a] shadow-[0_0_8px_rgba(59,130,246,0.5)] pointer-events-none"
                    style={{
                      left: `calc(${decomposer.depth === 'auto' ? 0 : ((Number(decomposer.depth) - 2) / 8) * 100}% - 8px)`,
                    }}
                  />
                </div>
              </div>
            </div>
            <Slider
              label="Max Tokens"
              value={decomposer.maxTokens}
              min={64}
              max={2048}
              step={64}
              onChange={(v) => setDecomp({ maxTokens: v })}
              disabled={disabled}
              unit=" tok"
            />
          </div>
        </ClusterSection>

        {/* 2. Solvers */}
        <ClusterSection
          icon="🗳️"
          title="Solvers"
          accentColor="#3b82f6"
          summary={`${solver.numVoters} agents · Temp ${solver.temperature} · TopK ${solver.topK} · ${solver.maxTokens} tok`}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Slider
                label={`Number of Voters (k)`}
                value={solver.numVoters}
                min={1}
                max={9}
                onChange={(v) => setSolver({ numVoters: v })}
                disabled={disabled}
                format={(v) => `${v} agents`}
              />
            </div>
            <Slider
              label="Temperature"
              value={solver.temperature}
              min={0}
              max={1.5}
              step={0.1}
              onChange={(v) => setSolver({ temperature: v })}
              disabled={disabled}
            />
            <Slider
              label="Top-K"
              value={solver.topK}
              min={1}
              max={50}
              onChange={(v) => setSolver({ topK: v })}
              disabled={disabled}
            />
            <Slider
              label="Max Tokens"
              value={solver.maxTokens}
              min={128}
              max={2048}
              step={64}
              onChange={(v) => setSolver({ maxTokens: v })}
              disabled={disabled}
              unit=" tok"
            />
            <Toggle
              label="Independent Seeds"
              checked={solver.independentSeeds}
              onChange={(v) => setSolver({ independentSeeds: v })}
              disabled={disabled}
            />
          </div>
        </ClusterSection>

        {/* 3. Validator */}
        <ClusterSection
          icon="🔍"
          title="Validator"
          accentColor="#f59e0b"
          summary={
            validator.enabled
              ? `±${validator.numericTolerance} tol · ${validator.strictness} · ${validator.rejectNonNumeric ? 'numeric only' : 'any answer'}`
              : 'Disabled'
          }
          headerExtra={
            <button
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation();
                setValidator({ enabled: !validator.enabled });
              }}
              className={`rounded-xl border px-2.5 py-1 text-xs font-medium transition-all ${
                validator.enabled
                  ? 'border-[#f59e0b]/40 bg-[#f59e0b]/15 text-[#fcd34d]'
                  : 'border-white/10 text-[#6b7280]'
              } disabled:cursor-not-allowed`}
            >
              {validator.enabled ? 'ON' : 'OFF'}
            </button>
          }
        >
          <div className={`grid gap-4 sm:grid-cols-2 ${!validator.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <Slider
              label="Numeric Tolerance"
              value={validator.numericTolerance}
              min={0}
              max={10}
              step={0.1}
              onChange={(v) => setValidator({ numericTolerance: v })}
              disabled={disabled || !validator.enabled}
              format={(v) => `±${v}`}
            />
            <Toggle
              label="Reject Non-Numeric"
              checked={validator.rejectNonNumeric}
              onChange={(v) => setValidator({ rejectNonNumeric: v })}
              disabled={disabled || !validator.enabled}
            />
            <div className="sm:col-span-2">
              <SegmentedControl
                label="Strictness"
                options={[
                  { id: 'low', label: 'Low' },
                  { id: 'medium', label: 'Medium' },
                  { id: 'high', label: 'High' },
                ]}
                value={validator.strictness}
                onChange={(v) => setValidator({ strictness: v })}
                disabled={disabled || !validator.enabled}
              />
            </div>
          </div>
        </ClusterSection>

        {/* 4. Aggregator */}
        <ClusterSection
          icon="📊"
          title="Aggregator"
          accentColor="#10b981"
          summary={`${aggregator.votingStrategy} vote · ±${aggregator.groupingTolerance} tol · ${aggregator.tieBreaking} tie`}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Slider
              label="Grouping Tolerance"
              value={aggregator.groupingTolerance}
              min={0}
              max={10}
              step={0.1}
              onChange={(v) => setAggregator({ groupingTolerance: v })}
              disabled={disabled}
              format={(v) => `±${v}`}
            />
            <div className="sm:col-span-2">
              <SegmentedControl
                label="Voting Strategy"
                options={[
                  { id: 'majority', label: 'Majority' },
                  { id: 'weighted', label: 'Weighted' },
                  { id: 'unanimous', label: 'Unanimous' },
                  { id: 'ranked', label: 'Ranked' },
                ]}
                value={aggregator.votingStrategy}
                onChange={(v) => setAggregator({ votingStrategy: v })}
                disabled={disabled}
              />
            </div>
            <SegmentedControl
              label="Tie-Breaking"
              options={[
                { id: 'first', label: 'First' },
                { id: 'random', label: 'Random' },
                { id: 'rerun', label: 'Re-run' },
              ]}
              value={aggregator.tieBreaking}
              onChange={(v) => setAggregator({ tieBreaking: v })}
              disabled={disabled}
            />
            <SegmentedControl
              label="Consensus"
              options={[
                { id: 'simple', label: 'Simple' },
                { id: 'supermajority', label: 'Super' },
              ]}
              value={aggregator.consensusThreshold}
              onChange={(v) => setAggregator({ consensusThreshold: v })}
              disabled={disabled}
            />
          </div>
        </ClusterSection>
      </div>
    </div>
  );
}
