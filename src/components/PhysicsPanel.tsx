import { useState } from 'react';
import { Slider } from './ui/slider';
import { ChevronDown, ChevronRight, Settings2 } from 'lucide-react';
import type { PhysicsParams } from '../engine/types';
import { DEFAULT_PHYSICS } from '../engine/types';

interface Props {
  physics: PhysicsParams;
  onChange: (p: PhysicsParams) => void;
}

export function PhysicsPanel({ physics, onChange }: Props) {
  const [open, setOpen] = useState(false);

  const update = (key: keyof PhysicsParams, val: number) => {
    onChange({ ...physics, [key]: val });
  };

  const reset = () => onChange(DEFAULT_PHYSICS);

  const Control = ({ label, prop, min, max, step }: { label: string, prop: keyof PhysicsParams, min: number, max: number, step: number }) => (
    <div className="flex flex-col gap-1 mb-3">
      <div className="flex justify-between items-center">
        <label className="text-xs text-muted-foreground font-medium">{label}</label>
        <input 
          type="number" 
          value={physics[prop]} 
          onChange={e => update(prop, parseFloat(e.target.value) || 0)}
          className="w-16 h-6 text-xs text-right px-1 py-0 bg-background border rounded"
          step={step}
        />
      </div>
      <Slider 
        min={min} 
        max={max} 
        step={step} 
        value={[physics[prop]]} 
        onValueChange={v => update(prop, v[0])}
        className="mt-1"
      />
    </div>
  );

  return (
    <div className="absolute bottom-4 right-4 z-50 w-64 bg-card/90 backdrop-blur-md border rounded-md shadow-lg">
      <div 
        className="flex items-center justify-between p-2 cursor-pointer hover:bg-muted/50 rounded transition-colors"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2 w-full text-sm font-semibold">
          <Settings2 className="w-4 h-4 text-primary" />
          <span>Physics Tuner</span>
          {open ? <ChevronDown className="w-4 h-4 ml-auto" /> : <ChevronRight className="w-4 h-4 ml-auto" />}
        </div>
      </div>
      
      {open && (
        <div className="p-3 border-t max-h-[60vh] overflow-y-auto">
          <Control label="Link Distance" prop="linkDistance" min={10} max={300} step={5} />
          <Control label="Link Strength" prop="linkStrength" min={0} max={2} step={0.05} />
          <Control label="Charge (Repulsion)" prop="chargeStrength" min={-3000} max={0} step={50} />
          <Control label="Charge Max Dist" prop="chargeDistanceMax" min={100} max={3000} step={100} />
          <Control label="Outward Expansion" prop="outwardStrength" min={0} max={300} step={5} />
          <Control label="Elastic Base Dist" prop="progressiveLinkBase" min={50} max={500} step={10} />
          <Control label="Elastic Scale" prop="progressiveLinkScale" min={0} max={0.2} step={0.005} />
          <Control label="Collide Padding" prop="collideRadiusOffset" min={0} max={100} step={5} />
          <Control label="Collide Strength" prop="collideStrength" min={0} max={2} step={0.1} />
          <Control label="Alpha Decay" prop="alphaDecay" min={0.001} max={0.1} step={0.001} />
          <Control label="Velocity Decay" prop="velocityDecay" min={0.1} max={0.99} step={0.01} />
          
          <button 
            onClick={reset}
            className="mt-2 w-full text-xs py-1.5 bg-muted hover:bg-muted/80 border rounded transition-colors"
          >
            Reset to Defaults
          </button>
        </div>
      )}
    </div>
  );
}
