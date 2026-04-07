import { useState } from 'react';
import { ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';
import { Slider } from './ui/slider';
import { Switch } from './ui/switch';
import { Button } from './ui/button';
import type { RAFParams } from '../engine/types';
import { DEFAULT_PARAMS } from '../engine/types';

function Section({ title, color, children, defaultOpen = false }: {
  title: string; color: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border rounded-md overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-3 py-2 hover:bg-accent/40 transition-colors text-xs"
      >
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: color }} />
          <span className="font-medium text-foreground">{title}</span>
        </div>
        {open
          ? <ChevronDown className="h-3 w-3 text-muted-foreground" />
          : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 space-y-3 border-t border-border bg-card/30">{children}</div>
      )}
    </div>
  );
}

function PS({ label, value, min, max, onChange, disabled }: {
  label: string; value: number; min: number; max: number;
  onChange: (v: number) => void; disabled: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono text-foreground tabular-nums">{value}</span>
      </div>
      <Slider min={min} max={max} step={1} value={[value]}
        onValueChange={([v]) => onChange(v)} disabled={disabled} />
    </div>
  );
}

export function ParamPanel({
  params,
  onChange,
  disabled,
}: {
  params: RAFParams;
  onChange: (p: RAFParams) => void;
  disabled: boolean;
}) {
  const set = (p: Partial<RAFParams>) => onChange({ ...params, ...p });
  const isDefault = JSON.stringify(params) === JSON.stringify(DEFAULT_PARAMS);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
          RAF Parameters
        </span>
        <Button
          variant="ghost" size="sm"
          className="h-6 text-xs px-2 gap-1"
          disabled={isDefault || disabled}
          onClick={() => onChange({ ...DEFAULT_PARAMS })}
        >
          <RotateCcw className="h-3 w-3" /> Reset
        </Button>
      </div>

      {/* Extra context layer — top-level toggle */}
      <div className="flex items-center justify-between px-1 py-1 rounded-md border border-border bg-card/50 text-xs">
        <span className="text-muted-foreground">Extra Context Layer</span>
        <Switch
          checked={params.extraContextLayer}
          onCheckedChange={v => set({ extraContextLayer: v })}
          disabled={disabled}
        />
      </div>

      <Section title="Base Case Jury" color="#e040fb" defaultOpen>
        <PS label="Jury Size" value={params.baseCaseJurySize} min={1} max={12}
          onChange={v => set({ baseCaseJurySize: v })} disabled={disabled} />
      </Section>

      <Section title="Design Consortium" color="#69ff47">
        <PS label="Consortium Size" value={params.baseCaseConsortiumSize} min={1} max={10}
          onChange={v => set({ baseCaseConsortiumSize: v })} disabled={disabled} />
        <PS label="Design Jury Size" value={params.baseCaseDesignJurySize} min={1} max={10}
          onChange={v => set({ baseCaseDesignJurySize: v })} disabled={disabled} />
      </Section>

      <Section title="Execution & Analysis" color="#ff9100">
        <PS label="Analysis Consortium" value={params.analysisConsortiumSize} min={1} max={10}
          onChange={v => set({ analysisConsortiumSize: v })} disabled={disabled} />
        <PS label="Analysis Jury" value={params.analysisJurySize} min={1} max={10}
          onChange={v => set({ analysisJurySize: v })} disabled={disabled} />
      </Section>

      <Section title="Recursive Planning" color="#ffeb3b">
        <PS label="Plan Consortium" value={params.planConsortiumSize} min={1} max={10}
          onChange={v => set({ planConsortiumSize: v })} disabled={disabled} />
        <PS label="Plan Jury" value={params.planJurySize} min={1} max={10}
          onChange={v => set({ planJurySize: v })} disabled={disabled} />
      </Section>

      <Section title="Error Correction" color="#f43f5e">
        <PS label="Error Finder Jury" value={params.errorFinderJurySize} min={1} max={10}
          onChange={v => set({ errorFinderJurySize: v })} disabled={disabled} />
        <PS label="Recovery Consortium" value={params.recoveryConsortiumSize} min={1} max={10}
          onChange={v => set({ recoveryConsortiumSize: v })} disabled={disabled} />
      </Section>

      <Section title="Sampling (TopK)" color="#64748b">
        <PS label="Min TopK" value={params.minTopK} min={1} max={50}
          onChange={v => set({ minTopK: Math.min(v, params.maxTopK) })} disabled={disabled} />
        <PS label="Max TopK" value={params.maxTopK} min={1} max={50}
          onChange={v => set({ maxTopK: Math.max(v, params.minTopK) })} disabled={disabled} />
      </Section>
    </div>
  );
}
