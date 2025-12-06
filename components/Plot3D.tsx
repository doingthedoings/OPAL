import React, { useEffect, useRef, useState } from 'react';
import { Dataset, InterpolationConfig } from '../types';
import { generateSurface } from '../services/interpolation';

interface Plot3DProps {
  datasets: Dataset[];
  config: InterpolationConfig;
  onSelectPoint: (datasetId: number, lineIndex: number) => void;
  selectedPoint: { datasetId: number, lineIndex: number } | null;
  onUpdatePoint: (lineIndex: number, newPA: number) => void;
}

export const Plot3D: React.FC<Plot3DProps> = ({ datasets, config, onSelectPoint, selectedPoint, onUpdatePoint }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [plotData, setPlotData] = useState<any[]>([]);
  const [layout, setLayout] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Prepare data for Plotly
  useEffect(() => {
    setIsGenerating(true);
    // Defer to allow UI to update
    const timer = setTimeout(() => {
      const newTraces: any[] = [];
      const visibleDatasets = datasets.filter(d => d.visible && d.points.length > 0);
      const isSingleVisible = visibleDatasets.length === 1;

      datasets.forEach(ds => {
        if (!ds.visible || ds.points.length === 0) return;

        const { xi, yi, zi } = generateSurface(ds.points, config.method, config.gridResolution, {
          basis: config.rbfBasis,
          epsilon: config.epsilon,
          lambda: config.lambda,
          power: config.power,
          scaleX: config.scaleX,
          scaleY: config.scaleY
        });

        // Determine Surface Appearance
        let surfaceColorscale: any = 'Viridis';
        let showScale = false;
        
        if (!isSingleVisible) {
           // Monochromatic for multi-view
           surfaceColorscale = [
            [0, ds.color],
            [1, ds.color]
           ];
        }

        const surfaceTrace = {
          type: 'surface',
          x: xi,
          y: yi,
          z: zi,
          colorscale: surfaceColorscale,
          opacity: config.opacity,
          showscale: showScale,
          contours: {
            z: { show: config.showContours, usecolormap: isSingleVisible, color: 'white', highlightcolor: '#fff', project: { z: true } }
          },
          hovertemplate: `<b>${ds.name}</b><br>Flow: %{x:.2f}<br>Accel: %{y}<br>PA: %{z:.3f}<extra></extra>`,
          name: ds.name
        };

        // Determine Point Appearance
        let pointColor: any;
        let pointOpacity: any;
        
        if (isSingleVisible) {
            // Standard highlighting for single view
            pointColor = ds.points.map(p => (selectedPoint?.datasetId === ds.id && p.lineIndex === selectedPoint.lineIndex) ? '#ef4444' : '#3b82f6');
            pointOpacity = ds.points.map(p => (selectedPoint?.datasetId === ds.id && p.lineIndex === selectedPoint.lineIndex) ? 1 : 0.8);
        } else {
            // High contrast color for multi-view
            pointColor = ds.points.map(p => (selectedPoint?.datasetId === ds.id && p.lineIndex === selectedPoint.lineIndex) ? '#ffffff' : ds.pointColor);
            pointOpacity = ds.points.map(p => (selectedPoint?.datasetId === ds.id && p.lineIndex === selectedPoint.lineIndex) ? 1 : 0.9);
        }

        const sizes = ds.points.map(p => (selectedPoint?.datasetId === ds.id && p.lineIndex === selectedPoint.lineIndex) ? 8 : 5);

        const scatterTrace = {
          type: 'scatter3d',
          mode: 'markers',
          x: ds.points.map(p => p.fr),
          y: ds.points.map(p => p.acc),
          z: ds.points.map(p => p.pa + 0.002), // Slight offset to sit on surface
          marker: {
            size: sizes,
            color: pointColor,
            opacity: pointOpacity,
            line: { width: 0.5, color: '#000' } // Clean border
          },
          hovertemplate: `<b>${ds.name} Sample</b><br>Flow: %{x:.2f}<br>Accel: %{y}<br>PA: %{z:.3f}<extra></extra>`,
          customdata: ds.points.map(p => [ds.id, p.lineIndex])
        };

        // Invisible Hit Target Trace (Larger markers for easier clicking)
        const hitTrace = {
          type: 'scatter3d',
          mode: 'markers',
          x: ds.points.map(p => p.fr),
          y: ds.points.map(p => p.acc),
          z: ds.points.map(p => p.pa + 0.002),
          marker: {
            size: 30, // Much larger click area
            opacity: 0, // Invisible
            color: 'rgba(0,0,0,0)'
          },
          hoverinfo: 'none', // No tooltip for this layer
          customdata: ds.points.map(p => [ds.id, p.lineIndex])
        };

        newTraces.push(surfaceTrace, scatterTrace, hitTrace);
      });

      setPlotData(newTraces);
      setIsGenerating(false);
    }, 10);

    return () => clearTimeout(timer);
  }, [datasets, config, selectedPoint]);

  // Initialize Plot Layout
  useEffect(() => {
    const baseLayout = {
      title: { text: '', font: { color: '#e4e4e7' } },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      margin: { l: 0, r: 0, t: 0, b: 0 },
      scene: {
        dragmode: 'turntable',
        xaxis: { title: 'Flow Rate', gridcolor: '#3f3f46', zerolinecolor: '#71717a', titlefont: { color: '#a1a1aa' }, tickfont: { color: '#71717a' } },
        yaxis: { title: 'Accel', gridcolor: '#3f3f46', zerolinecolor: '#71717a', titlefont: { color: '#a1a1aa' }, tickfont: { color: '#71717a' } },
        zaxis: { title: 'Pressure Adv', gridcolor: '#3f3f46', zerolinecolor: '#71717a', range: [config.zMin, config.zMax], titlefont: { color: '#a1a1aa' }, tickfont: { color: '#71717a' } },
        camera: { eye: { x: 1.5, y: 1.5, z: 1.2 } },
        aspectmode: 'manual',
        aspectratio: { x: 1, y: 1, z: 0.8 }
      },
      showlegend: false,
      uirevision: 'true', // Preserve camera state on updates
    };
    setLayout(baseLayout);
  }, []); // Only run once for initial layout

  // Update Layout when Config Changes (Z-Axis)
  useEffect(() => {
    if (!layout) return;
    setLayout(prev => ({
      ...prev,
      scene: {
        ...prev.scene,
        zaxis: {
          ...prev.scene.zaxis,
          range: [config.zMin, config.zMax]
        }
      }
    }));
  }, [config.zMin, config.zMax]);

  // React-Plotly Lifecycle Management using window.Plotly
  useEffect(() => {
    if (!containerRef.current || !window.Plotly) return;

    const el = containerRef.current;
    
    // Initial Draw or React Update
    window.Plotly.react(el, plotData, layout, { displaylogo: false, responsive: true });

    // Event Listeners
    const handleClick = (data: any) => {
      const pt = data.points[0];
      if (pt && pt.data.type === 'scatter3d') {
        const [dsId, lineIdx] = pt.customdata;
        onSelectPoint(dsId, lineIdx);
      }
    };

    el.on('plotly_click', handleClick);

    return () => {
      // Cleanup if component unmounts (rare for this app structure)
      // window.Plotly.purge(el); 
    };
  }, [plotData, layout, onSelectPoint]);


  // Find selected point for the floating editor
  const selectedDataset = selectedPoint ? datasets.find(d => d.id === selectedPoint.datasetId) : null;
  const selectedPointData = selectedDataset ? selectedDataset.points.find(p => p.lineIndex === selectedPoint.lineIndex) : null;

  return (
    <div className="relative w-full h-full bg-zinc-950 rounded-lg border border-zinc-800 overflow-hidden">
       {/* Loading Indicator */}
       {isGenerating && (
         <div className="absolute top-4 right-4 z-20 bg-zinc-900/80 backdrop-blur px-3 py-1 rounded text-xs text-yellow-400 border border-yellow-400/30 shadow-lg">
           Computing Surface...
         </div>
       )}

      <div ref={containerRef} className="w-full h-full" />

      {/* Floating Editor for Selected Point */}
      {selectedPointData && selectedDataset && (
        <div className="absolute bottom-6 right-6 z-30 bg-zinc-900/90 backdrop-blur-md border border-zinc-700 p-4 rounded-xl shadow-2xl w-64 animate-in slide-in-from-bottom-4 fade-in duration-200">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold text-white">Edit Point ({selectedDataset.name})</h3>
            <button onClick={() => onSelectPoint(-1, -1)} className="text-zinc-400 hover:text-white">✕</button>
          </div>
          
          <div className="space-y-3 text-xs">
             <div className="grid grid-cols-2 gap-2 text-zinc-400">
               <div>Flow: <span className="text-zinc-200">{selectedPointData.fr}</span></div>
               <div>Accel: <span className="text-zinc-200">{selectedPointData.acc}</span></div>
             </div>

             <div>
               <label className="block text-blue-400 font-medium mb-1">Pressure Advance (Z)</label>
               <div className="flex gap-2 items-center">
                  <input 
                    type="range" 
                    min={config.zMin} 
                    max={config.zMax} 
                    step={0.001}
                    value={selectedPointData.pa}
                    onChange={(e) => onUpdatePoint(selectedPointData.lineIndex, parseFloat(e.target.value))}
                    className="flex-1 accent-blue-500 h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                  />
                  <input 
                    type="number" 
                    value={selectedPointData.pa}
                    step={0.001}
                    onChange={(e) => onUpdatePoint(selectedPointData.lineIndex, parseFloat(e.target.value))}
                    className="w-16 bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 text-center focus:border-blue-500 outline-none"
                  />
               </div>
             </div>
             <p className="text-[10px] text-zinc-500 italic mt-1">
               Adjusting this updates the raw data immediately.
             </p>
          </div>
        </div>
      )}
    </div>
  );
};