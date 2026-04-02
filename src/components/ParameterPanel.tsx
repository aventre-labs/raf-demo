import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, RotateCcw, Cpu } from 'lucide-react';

export interface RAFParams {
  numVoters: number;
  decompTopK: number;
  solveTopK: number;
  votingStrategy: 'majority' | 'weighted' | 'unanimous';
  decompositionDepth: number;
}

export const DEFAULT_PARAMS: RAFParams = {
  numVoters: 3,
  decompTopK: 2,
  solveTopK: 4,
  votingStrategy: 'majority',
  decompositionDepth: 5,
};

interface Props {
  params: RAFParams;
  onChange: (params: RAFParams) => void;
  disabled?: boolean;
}

const ease = [0.25, 0.46, 0.45, 0.94] as const;

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  disabled,
  unit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  unit?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-[#9ca3af] uppercase tracking-[0.16em]">{label}</label>
        <span className="font-['Space_Grotesk'] text-sm font-semibold text-white">
          {value}{unit}
        </span>
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

export default function ParameterPanel({ params, onChange, disabled }: Props) {
  const [open, setOpen] = useState(true);

  const isDefault =
    params.numVoters === DEFAULT_PARAMS.numVoters &&
    params.decompTopK === DEFAULT_PARAMS.decompTopK &&
    params.solveTopK === DEFAULT_PARAMS.solveTopK &&
    params.votingStrategy === DEFAULT_PARAMS.votingStrategy &&
    params.decompositionDepth === DEFAULT_PARAMS.decompositionDepth;

  const set = <K extends keyof RAFParams>(key: K, val: RAFParams[K]) =>
    onChange({ ...params, [key]: val });

  const strategies: { id: RAFParams['votingStrategy']; label: string; desc: string }[] = [
    { id: 'majority', label: 'Majority', desc: '≥50% agree' },
    { id: 'weighted', label: 'Weighted', desc: 'confidence-weighted' },
    { id: 'unanimous', label: 'Unanimous', desc: 'all must agree' },
  ];

  return (
    <div className="rounded-[24px] border border-white/8 bg-[#0d1524] overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#3b82f6]/15 border border-[#3b82f6]/20">
            <Cpu className="h-4 w-4 text-[#3b82f6]" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">Parameters</div>
            <div className="text-xs text-[#6b7280]">
              {params.numVoters} voters · TopK {params.decompTopK}/{params.solveTopK} · {params.votingStrategy} vote · depth {params.decompositionDepth}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isDefault && (
            <div className="h-1.5 w-1.5 rounded-full bg-[#f59e0b]" title="Custom params active" />
          )}
          <ChevronDown
            className={`h-4 w-4 text-[#6b7280] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/6 p-4 space-y-5">
              {/* Model info */}
              <div className="flex items-center gap-3 rounded-2xl border border-[#10b981]/20 bg-[#10b981]/8 px-4 py-3">
                <div className="h-2 w-2 rounded-full bg-[#10b981] animate-pulse" />
                <div className="text-xs text-[#d1fae5]">
                  <span className="font-semibold">Llama 3.1 8B</span>
                  <span className="text-[#6ee7b7]"> · Taalas HC1 · ~17k tok/s</span>
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                {/* Left column */}
                <div className="space-y-5">
                  <Slider
                    label="Number of Voters"
                    value={params.numVoters}
                    min={1}
                    max={7}
                    onChange={(v) => set('numVoters', v)}
                    disabled={disabled}
                  />
                  <Slider
                    label="Decompose TopK"
                    value={params.decompTopK}
                    min={1}
                    max={20}
                    onChange={(v) => set('decompTopK', v)}
                    disabled={disabled}
                  />
                  <Slider
                    label="Solve TopK"
                    value={params.solveTopK}
                    min={1}
                    max={20}
                    onChange={(v) => set('solveTopK', v)}
                    disabled={disabled}
                  />
                  <Slider
                    label="Decomposition Depth"
                    value={params.decompositionDepth}
                    min={1}
                    max={10}
                    onChange={(v) => set('decompositionDepth', v)}
                    disabled={disabled}
                  />
                </div>

                {/* Right column — voting strategy */}
                <div className="space-y-3">
                  <div className="text-xs font-medium text-[#9ca3af] uppercase tracking-[0.16em]">Voting Strategy</div>
                  <div className="space-y-2">
                    {strategies.map((strategy) => {
                      const active = params.votingStrategy === strategy.id;
                      return (
                        <button
                          key={strategy.id}
                          disabled={disabled}
                          onClick={() => set('votingStrategy', strategy.id)}
                          className={`w-full rounded-2xl border px-4 py-3 text-left transition-all ${
                            active
                              ? 'border-[#3b82f6]/50 bg-[#3b82f6]/12 shadow-[0_0_16px_rgba(59,130,246,0.12)]'
                              : 'border-white/8 bg-white/[0.03] hover:border-white/14'
                          } disabled:cursor-not-allowed disabled:opacity-50`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={`text-sm font-medium ${active ? 'text-[#93c5fd]' : 'text-[#e5e7eb]'}`}>
                              {strategy.label}
                            </span>
                            <span className="text-xs text-[#6b7280]">{strategy.desc}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Auto preset */}
                  <motion.button
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    disabled={isDefault || disabled}
                    onClick={() => onChange({ ...DEFAULT_PARAMS })}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 py-3 text-sm font-medium text-[#9ca3af] hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 transition-all"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset to paper defaults (Auto)
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
