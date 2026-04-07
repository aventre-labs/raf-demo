import { useState } from 'react';
import { ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';
import { Slider } from './ui/slider';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import type { RAFParams } from '../engine/types';
import { DEFAULT_PARAMS } from '../engine/types';

function Section({ title, color, children, defaultOpen = false }: {
  title: string; color: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border rounded-md overflow-hidden text-xs">
      <button onClick={() => setOpen(o => !o)} className="flex w-full items-center justify-between px-3 py-2 hover:bg-accent/40 transition-colors">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: color }} />
          <span className="font-medium text-foreground">{title}</span>
        </div>
        {open ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
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
      <div className="flex justify-between">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono text-foreground">{value}</span>
      </div>
      <Slider min={min} max={max} step={1} value={[value]}
        onValueChange={([v]) => onChange(v)} disabled={disabled} />
    </div>
  );
}

export function ParamPanel({ params, onChange, disabled }: { params: RAFParams; onChange: (p: RAFParams) => void; disabled: boolean }) {
  const set = (p: Partial<RAFParams>) => onChange({ ...params, ...p });
  const isDefault = JSON.stringify(params) === JSON.stringify(DEFAULT_PARAMS);

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground uppercase tracking-wider text-[10px]">RAF Parameters</span>
        <Button variant="ghost" size="sm" className="h-6 text-xs px-2 gap-1" disabled={isDefault || disabled}
          onClick={() => onChange({ ...DEFAULT_PARAMS })}>
          <RotateCcw className="h-3 w-3" /> Reset
        </Button>
      </div>

      <div className="flex items-center justify-between px-1 py-1 rounded-md border border-border bg-card/50">
        <Label className="text-xs text-muted-foreground cursor-pointer">Simulation Mode</Label>
        <div className="flex items-center gap-2">
          <Switch checked={params.simulationMode} onCheckedChange={v => set({ simulationMode: v })} disabled={disabled} />
          <Badge variant={params.simulationMode ? 'secondary' : 'default'} className="text-[10px]">
            {params.simulationMode ? 'Sim' : 'Live'}
          </Badge>
        </div>
      </div>

      <Section title="Recursion" color="#00e5ff" defaultOpen>
        <PS label="Max Depth" value={params.maxDepth} min={0} max={3} onChange={v => set({ maxDepth: v })} disabled={disabled} />
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Extra Context Layer</span>
          <Switch checked={params.extraContextLayer} onCheckedChange={v => set({ extraContextLayer: v })} disabled={disabled} />
        </div>
      </Section>

      <Section title="Base Case Jury" color="#e040fb">
        <PS label="Jury Size" value={params.baseCaseJurySize} min={1} max={10} onChange={v => set({ baseCaseJurySize: v })} disabled={disabled} />
      </Section>

      <Section title="Design Consortium" color="#69ff47">
        <PS label="Consortium Size" value={params.baseCaseConsortiumSize} min={1} max={8} onChange={v => set({ baseCaseConsortiumSize: v })} disabled={disabled} />
        <PS label="Jury Size" value={params.baseCaseDesignJurySize} min={1} max={8} onChange={v => set({ baseCaseDesignJurySize: v })} disabled={disabled} />
      </Section>

      <Section title="Execution & Analysis" color="#ff9100">
        <PS label="Analysis Consortium" value={params.analysisConsortiumSize} min={1} max={8} onChange={v => set({ analysisConsortiumSize: v })} disabled={disabled} />
        <PS label="Analysis Jury" value={params.analysisJurySize} min={1} max={8} onChange={v => set({ analysisJurySize: v })} disabled={disabled} />
      </Section>

      <Section title="Recursive Planning" color="#ffeb3b">
        <PS label="Plan Consortium" value={params.planConsortiumSize} min={1} max={8} onChange={v => set({ planConsortiumSize: v })} disabled={disabled} />
        <PS label="Plan Jury" value={params.planJurySize} min={1} max={8} onChange={v => set({ planJurySize: v })} disabled={disabled} />
      </Section>

      <Section title="Sampling" color="#64748b">
        <PS label="Min TopK" value={params.minTopK} min={1} max={50} onChange={v => set({ minTopK: Math.min(v, params.maxTopK) })} disabled={disabled} />
        <PS label="Max TopK" value={params.maxTopK} min={1} max={50} onChange={v => set({ maxTopK: Math.max(v, params.minTopK) })} disabled={disabled} />
      </Section>
    </div>
  );
}
