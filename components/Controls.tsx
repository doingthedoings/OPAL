import React from 'react';
import { InterpolationConfig, InterpolationMethod, RBFBasis, ScaleMode } from '../types';

interface ControlsProps {
  config: InterpolationConfig;
  onChange: (newConfig: InterpolationConfig) => void;
}

export const Controls: React.FC<ControlsProps> = ({ config, onChange }) => {
  
  const update = (key: keyof InterpolationConfig, value: any) => {
    onChange({ ...config, [key]: value });
  };

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto pr-1 text-sm">
      
      {/* Interpolation Method */}
      <section className="p-4 rounded-lg bg-zinc-900 border border-zinc-800">
        <h3 className="text-zinc-100 font-semibold mb-3 text-xs uppercase tracking-wider">Algorithm</h3>
        
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-zinc-400 text-xs">Method</label>
            <select 
              value={config.method}
              onChange={(e) => update('method', e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-zinc-200 outline-none focus:border-blue-500 transition-colors"
            >
              <option value={InterpolationMethod.PCHIP}>PCHIP (OrcaSlicer)</option>
              <option value={InterpolationMethod.RBF}>RBF (Smooth)</option>
              <option value={InterpolationMethod.IDW}>IDW (Simple)</option>
            </select>
          </div>

          {config.method === InterpolationMethod.RBF && (
             <>
               <div className="space-y-1">
                 <label className="text-zinc-400 text-xs">RBF Basis</label>
                 <select 
                   value={config.rbfBasis}
                   onChange={(e) => update('rbfBasis', e.target.value)}
                   className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-zinc-200"
                 >
                   <option value={RBFBasis.GAUSSIAN}>Gaussian</option>
                   <option value={RBFBasis.MULTIQUADRIC}>Multiquadric</option>
                   <option value={RBFBasis.THIN_PLATE}>Thin Plate Spline</option>
                   <option value={RBFBasis.LINEAR}>Linear</option>
                 </select>
               </div>

               <div className="space-y-1">
                 <div className="flex justify-between">
                    <label className="text-zinc-400 text-xs">Smoothness (ε)</label>
                    <span className="text-zinc-500 text-xs">{config.epsilon.toFixed(2)}</span>
                 </div>
                 <input 
                   type="range" min="0.1" max="5" step="0.1" 
                   value={config.epsilon} 
                   onChange={(e) => update('epsilon', parseFloat(e.target.value))}
                   className="w-full accent-blue-500 h-1 bg-zinc-700 rounded appearance-none"
                 />
               </div>

               <div className="space-y-1">
                 <div className="flex justify-between">
                    <label className="text-zinc-400 text-xs">Tension (λ)</label>
                    <span className="text-zinc-500 text-xs">{config.lambda.toFixed(3)}</span>
                 </div>
                 <input 
                   type="range" min="0" max="0.2" step="0.001" 
                   value={config.lambda} 
                   onChange={(e) => update('lambda', parseFloat(e.target.value))}
                   className="w-full accent-blue-500 h-1 bg-zinc-700 rounded appearance-none"
                 />
               </div>
             </>
          )}

          {config.method === InterpolationMethod.IDW && (
             <div className="space-y-1">
                <div className="flex justify-between">
                   <label className="text-zinc-400 text-xs">Power</label>
                   <span className="text-zinc-500 text-xs">{config.power.toFixed(1)}</span>
                </div>
                <input 
                  type="range" min="1" max="10" step="0.5" 
                  value={config.power} 
                  onChange={(e) => update('power', parseFloat(e.target.value))}
                  className="w-full accent-blue-500 h-1 bg-zinc-700 rounded appearance-none"
                />
             </div>
          )}
        </div>
      </section>

      {/* Axis Scaling */}
      <section className="p-4 rounded-lg bg-zinc-900 border border-zinc-800">
        <h3 className="text-zinc-100 font-semibold mb-3 text-xs uppercase tracking-wider">Scaling Strategy</h3>
        <div className="space-y-3">
             <div className="space-y-1">
               <label className="text-zinc-400 text-xs">Mode</label>
               <select 
                  value={config.scaleMode}
                  onChange={(e) => update('scaleMode', e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-zinc-200 outline-none focus:border-blue-500"
               >
                 <option value={ScaleMode.RANGE}>Auto (Range)</option>
                 <option value={ScaleMode.STD}>Auto (Std Dev)</option>
                 <option value={ScaleMode.MANUAL}>Manual</option>
               </select>
             </div>
             
             <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                    <label className="text-zinc-500 text-[10px]">X Scale (Flow)</label>
                    <input 
                      type="number" 
                      value={parseFloat(config.scaleX.toFixed(4))}
                      disabled={config.scaleMode !== ScaleMode.MANUAL}
                      onChange={(e) => update('scaleX', parseFloat(e.target.value))}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-zinc-300 disabled:opacity-50"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-zinc-500 text-[10px]">Y Scale (Accel)</label>
                    <input 
                      type="number" 
                      value={parseFloat(config.scaleY.toFixed(4))}
                      disabled={config.scaleMode !== ScaleMode.MANUAL}
                      onChange={(e) => update('scaleY', parseFloat(e.target.value))}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-zinc-300 disabled:opacity-50"
                    />
                </div>
             </div>

             <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-800/50">
                <div className="space-y-1">
                    <label className="text-zinc-500 text-[10px]">Z Min (PA)</label>
                    <input 
                      type="number" 
                      step="0.001"
                      value={parseFloat(config.zMin.toFixed(4))}
                      disabled={config.scaleMode !== ScaleMode.MANUAL}
                      onChange={(e) => update('zMin', parseFloat(e.target.value))}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-zinc-300 disabled:opacity-50"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-zinc-500 text-[10px]">Z Max (PA)</label>
                    <input 
                      type="number" 
                      step="0.001"
                      value={parseFloat(config.zMax.toFixed(4))}
                      disabled={config.scaleMode !== ScaleMode.MANUAL}
                      onChange={(e) => update('zMax', parseFloat(e.target.value))}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-zinc-300 disabled:opacity-50"
                    />
                </div>
             </div>

             <button
               onClick={() => {
                 update('scaleMode', ScaleMode.RANGE);
                 // Trigger a tiny change to force re-eval if already RANGE? 
                 // Actually, App.tsx effect depends on scaleMode. 
                 // If it's already RANGE, we might need to toggle or force it.
                 // But usually user clicks this when they want to reset.
                 // We can also pass a specific 'force' action if needed, but setting to RANGE is a good start.
               }}
               className="w-full py-1.5 mt-1 text-xs font-medium text-blue-400 hover:text-blue-300 border border-blue-900/30 hover:border-blue-500/50 rounded bg-blue-900/10 transition-colors"
             >
               Force Auto-Rescale
             </button>
        </div>
      </section>

      {/* Visuals */}
      <section className="p-4 rounded-lg bg-zinc-900 border border-zinc-800">
        <h3 className="text-zinc-100 font-semibold mb-3 text-xs uppercase tracking-wider">Visualization</h3>
        <div className="space-y-3">
           <div className="flex items-center justify-between">
             <label className="text-zinc-400 text-xs">Show Contours</label>
             <input 
               type="checkbox" 
               checked={config.showContours} 
               onChange={(e) => update('showContours', e.target.checked)}
               className="w-4 h-4 accent-blue-500 rounded" 
             />
           </div>

           <div className="space-y-1">
              <div className="flex justify-between">
                  <label className="text-zinc-400 text-xs">Grid Resolution</label>
                  <span className="text-zinc-500 text-xs">{config.gridResolution}</span>
              </div>
              <input 
                type="range" min="20" max="200" step="10"
                value={config.gridResolution}
                onChange={(e) => update('gridResolution', parseInt(e.target.value))}
                className="w-full accent-blue-500 h-1 bg-zinc-700 rounded appearance-none"
              />
           </div>

           <div className="space-y-1">
              <div className="flex justify-between">
                  <label className="text-zinc-400 text-xs">Surface Opacity</label>
                  <span className="text-zinc-500 text-xs">{config.opacity.toFixed(1)}</span>
              </div>
              <input 
                type="range" min="0.1" max="1" step="0.1"
                value={config.opacity}
                onChange={(e) => update('opacity', parseFloat(e.target.value))}
                className="w-full accent-blue-500 h-1 bg-zinc-700 rounded appearance-none"
              />
           </div>
        </div>
      </section>
    </div>
  );
};