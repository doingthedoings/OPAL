import React, { useState, useEffect, useCallback } from 'react';
import { CodeEditor } from './components/CodeEditor';
import { Plot3D } from './components/Plot3D';
import { Controls } from './components/Controls';
import { DataCollection } from './components/DataCollection';
import { 
  AppState, 
  DataPoint, 
  InterpolationConfig, 
  InterpolationMethod, 
  RBFBasis, 
  ScaleMode,
  CollectionState,
  CollectionCell
} from './types';
import { createInterpolator } from './services/interpolation';
import { generateGrid } from './services/dataUtils';

const DEFAULT_DATA = [
	"0.02,1.95,2333", "0.035,5.86,2333", "0.035,1.95,500", "0.035,5.86,500",
	"0.01,1.95,4167", "0.03,5.86,4167", "0.01,1.95,6000", "0.02,5.86,6000",
	"0.02,9.77,6000", "0.045,9.77,500", "0.035,9.77,2333", "0.03,13.68,2333",
	"0.05,13.68,500", "0.025,13.68,4167", "0.03,9.77,4167", "0.02,13.68,6000"
].join("\n");

const DATASET_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#8b5cf6']; // Blue, Red, Emerald, Purple
const POINT_COLORS = ['#fb923c', '#22d3ee', '#e879f9', '#facc15']; // Orange, Cyan, Magenta, Yellow

enum ViewMode {
  VISUALIZER = 'visualizer',
  COLLECTION = 'collection'
}

function App() {
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.COLLECTION);
  
  const [activeTab, setActiveTab] = useState<'collection' | 'visualizer'>('collection');

  const [state, setState] = useState<AppState>({
    datasets: [
      { id: 0, name: 'Set 1', text: DEFAULT_DATA, points: [], errors: [], visible: true, color: DATASET_COLORS[0], pointColor: POINT_COLORS[0] },
      { id: 1, name: 'Set 2', text: '', points: [], errors: [], visible: false, color: DATASET_COLORS[1], pointColor: POINT_COLORS[1] },
      { id: 2, name: 'Set 3', text: '', points: [], errors: [], visible: false, color: DATASET_COLORS[2], pointColor: POINT_COLORS[2] },
      { id: 3, name: 'Combined', text: '', points: [], errors: [], visible: false, color: DATASET_COLORS[3], pointColor: POINT_COLORS[3] }
    ],
    activeDatasetId: 0,
    selectedPoint: null
  });

  const [collectionState, setCollectionState] = useState<CollectionState>({
    config: {
      accelMin: 500,
      accelMax: 3000,
      accelSteps: 3,
      speedMin: 25,
      speedMax: 150,
      speedSteps: 3,
      nozzleSize: 0.4,
      layerHeight: 0.2,
      lineWidth: 0.45, // Default to 0.4 * 1.125
      extrusionMultiplier: 1.0,
      maxPatterns: 0, // 0 = Unlimited
    },
    grid: {}
  });

  const [showPushConfirm, setShowPushConfirm] = useState(false);
  const [showCombineConfirm, setShowCombineConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [pushCandidateData, setPushCandidateData] = useState<{ config: CollectionState['config'], grid: CollectionState['grid'] } | null>(null);

  const [isChecking, setIsChecking] = useState(false);
  const [linearityError, setLinearityError] = useState<string | null>(null);
  const [showPushSelection, setShowPushSelection] = useState(false);
  const [selectedPushDatasets, setSelectedPushDatasets] = useState<number[]>([]);
  const [collectionResetKey, setCollectionResetKey] = useState(0);
  const [pushConfig, setPushConfig] = useState({
    nozzleSize: 0.4,
    flowRatio: 0.95
  });

  const [combinedDataset, setCombinedDataset] = useState<string | null>(null);
  const [useSmoothing, setUseSmoothing] = useState(true);
  const [smoothingLambda, setSmoothingLambda] = useState(0.01);

  const [config, setConfig] = useState<InterpolationConfig>({
    method: InterpolationMethod.PCHIP,
    rbfBasis: RBFBasis.GAUSSIAN,
    epsilon: 2.0,
    lambda: 0.005,
    power: 2.0,
    gridResolution: 100,
    scaleMode: ScaleMode.RANGE,
    scaleX: 1,
    scaleY: 1,
    zMin: 0,
    zMax: 0.1,
    opacity: 0.8,
    showContours: true
  });

  const [sidebarWidth, setSidebarWidth] = useState(380);

  // Helper to parse data
  const parseData = (text: string): { points: DataPoint[], errors: string[], minPa: number, maxPa: number } => {
    const lines = text.split('\n');
    const points: DataPoint[] = [];
    const errors: string[] = [];
    let maxPa = 0;
    let minPa = Infinity;

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      
      const parts = trimmed.split(',').map(s => s.trim());
      if (parts.length !== 3) {
        errors.push(`Line ${idx + 1}: Expected 3 values (PA, Flow, Accel)`);
        return;
      }

      const pa = parseFloat(parts[0]);
      const fr = parseFloat(parts[1]);
      const acc = parseFloat(parts[2]);

      if (isNaN(pa) || isNaN(fr) || isNaN(acc)) {
        errors.push(`Line ${idx + 1}: Invalid numbers`);
        return;
      }

      points.push({ pa, fr, acc, lineIndex: idx });
      if (pa > maxPa) maxPa = pa;
      if (pa < minPa) minPa = pa;
    });

    if (minPa === Infinity) { minPa = 0; maxPa = 0.1; }

    return { points, errors, minPa, maxPa };
  };

  // Parse Data Effect
  useEffect(() => {
    setState(prev => {
      let globalMinPa = Infinity;
      let globalMaxPa = -Infinity;

      const newDatasets = prev.datasets.map(ds => {
        const { points, errors, minPa, maxPa } = parseData(ds.text);
        if (points.length > 0) {
          if (minPa < globalMinPa) globalMinPa = minPa;
          if (maxPa > globalMaxPa) globalMaxPa = maxPa;
        }
        return { ...ds, points, errors };
      });
      
      return { ...prev, datasets: newDatasets };
    });
  }, [state.datasets.map(d => d.text).join('|||')]);

  // Dynamic Sidebar Width
  useEffect(() => {
    const activeDs = state.datasets[state.activeDatasetId];
    const lines = activeDs.text.split('\n');
    const maxLen = lines.reduce((max, line) => Math.max(max, line.length), 0);
    // Approx 8px per char (mono) + 60px padding (line nums + margins)
    // Min 280px, Max 600px
    const newWidth = Math.max(280, Math.min(600, maxLen * 8.5 + 60));
    setSidebarWidth(newWidth);
  }, [state.datasets[state.activeDatasetId].text, state.activeDatasetId]);

  // Auto Scale Effect
  useEffect(() => {
    const activeDs = state.datasets[state.activeDatasetId];
    if (activeDs.points.length > 0 && config.scaleMode !== ScaleMode.MANUAL) {
       const points = activeDs.points;
       const xVals = points.map(p => p.fr);
       const yVals = points.map(p => p.acc);
       
       let sx = 1, sy = 1;
       if (config.scaleMode === ScaleMode.RANGE) {
         sx = Math.max(1e-9, Math.max(...xVals) - Math.min(...xVals));
         sy = Math.max(1e-9, Math.max(...yVals) - Math.min(...yVals));
       } else {
         const mean = (arr: number[]) => arr.reduce((a,b)=>a+b,0) / arr.length;
         const std = (arr: number[]) => {
           const m = mean(arr);
           return Math.sqrt(arr.reduce((a,b)=>a+(b-m)**2,0)/arr.length);
         };
         sx = Math.max(1e-9, std(xVals));
         sy = Math.max(1e-9, std(yVals));
       }

       let minPa = Infinity;
       let maxPa = -Infinity;
       state.datasets.forEach(ds => {
         if (ds.visible && ds.points.length > 0) {
            ds.points.forEach(p => {
              if (p.pa < minPa) minPa = p.pa;
              if (p.pa > maxPa) maxPa = p.pa;
            });
         }
       });
       
       if (minPa === Infinity) { minPa = 0; maxPa = 0.1; }
       const padding = (maxPa - minPa) * 0.2;

       setConfig(c => ({
         ...c,
         scaleX: sx,
         scaleY: sy,
         zMin: Math.max(0, minPa - padding),
         zMax: maxPa + padding
       }));
    }
  }, [state.datasets, state.activeDatasetId, config.scaleMode]);

  // Handle Text Change
  const handleTextChange = (newText: string) => {
    setState(prev => {
      const newDatasets = [...prev.datasets];
      newDatasets[prev.activeDatasetId] = { ...newDatasets[prev.activeDatasetId], text: newText };
      return { ...prev, datasets: newDatasets };
    });
  };

  // Handle Point Update
  const handlePointUpdate = useCallback((lineIdx: number, newPa: number) => {
    setState(prev => {
      if (!prev.selectedPoint) return prev;
      const { datasetId } = prev.selectedPoint;
      
      const newDatasets = [...prev.datasets];
      const ds = newDatasets[datasetId];
      const lines = ds.text.split('\n');
      
      if (lineIdx >= 0 && lineIdx < lines.length) {
        const parts = lines[lineIdx].split(',');
        if (parts.length === 3) {
            parts[0] = newPa.toFixed(4);
            lines[lineIdx] = parts.join(',');
            newDatasets[datasetId] = { ...ds, text: lines.join('\n') };
            return { ...prev, datasets: newDatasets };
        }
      }
      return prev;
    });
  }, []);

  // Handle Clear Visualizer
  const handleClearVisualizer = () => {
    setState(prev => ({
      ...prev,
      datasets: [
        { id: 0, name: 'Set 1', text: '', points: [], errors: [], visible: true, color: DATASET_COLORS[0], pointColor: POINT_COLORS[0] },
        { id: 1, name: 'Set 2', text: '', points: [], errors: [], visible: false, color: DATASET_COLORS[1], pointColor: POINT_COLORS[1] },
        { id: 2, name: 'Set 3', text: '', points: [], errors: [], visible: false, color: DATASET_COLORS[2], pointColor: POINT_COLORS[2] },
        { id: 3, name: 'Combined', text: '', points: [], errors: [], visible: false, color: DATASET_COLORS[3], pointColor: POINT_COLORS[3] }
      ],
      activeDatasetId: 0,
      selectedPoint: null
    }));
  };

  const handleClearCollection = () => {
     setCollectionState(prev => ({
       ...prev,
       grid: generateGrid(prev.config)
     }));
     setCollectionResetKey(prev => prev + 1);
     setShowClearConfirm(false);
  };

  const requestClear = () => {
      setShowClearConfirm(true);
  };

  // Robust Average Helper
  const calculateRobustAverage = (values: number[]): number => {
    if (values.length < 3) return values.reduce((a, b) => a + b, 0) / values.length;

    // Calculate Median
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

    // Calculate Weights (Penalize deviation from median)
    let totalWeight = 0;
    let weightedSum = 0;

    values.forEach(v => {
      const diff = Math.abs(v - median);
      // Strong penalty for outliers: 1 / (1 + 1000 * diff^2)
      const weight = 1 / (1 + 1000 * diff * diff);
      weightedSum += v * weight;
      totalWeight += weight;
    });

    return weightedSum / totalWeight;
  };

  // Handle Combine
  const handleCombine = () => {
    const visibleDatasets = state.datasets.filter(d => d.visible && d.points.length > 0);
    if (visibleDatasets.length < 2) {
      alert("Please enable at least 2 datasets to combine.");
      return;
    }

    // 1. Collect all unique (fr, acc) points
    const uniquePoints = new Map<string, { fr: number, acc: number }>();
    visibleDatasets.forEach(ds => {
      ds.points.forEach(p => {
        const key = `${p.fr.toFixed(4)},${p.acc.toFixed(4)}`;
        if (!uniquePoints.has(key)) {
          uniquePoints.set(key, { fr: p.fr, acc: p.acc });
        }
      });
    });

    // 2. Create interpolators for each visible dataset
    const interpolators = visibleDatasets.map(ds => createInterpolator(ds.points, config.method, {
      basis: config.rbfBasis,
      epsilon: config.epsilon,
      lambda: config.lambda,
      power: config.power,
      scaleX: config.scaleX,
      scaleY: config.scaleY
    }));

    // 3. Calculate average PA for each point
    let combinedPointsData: { fr: number, acc: number, pa: number }[] = [];
    uniquePoints.forEach((pt) => {
      const predictedValues: number[] = [];
      interpolators.forEach(predict => {
        predictedValues.push(predict(pt.fr, pt.acc));
      });

      const avgPa = useSmoothing ? calculateRobustAverage(predictedValues) : (predictedValues.reduce((a,b)=>a+b,0) / predictedValues.length);
      combinedPointsData.push({ fr: pt.fr, acc: pt.acc, pa: avgPa });
    });

    // 4. Apply Surface Smoothing (if enabled)
    if (useSmoothing) {
       // Create a temporary smoother RBF
       const smoothInterpolator = createInterpolator(
         combinedPointsData.map((p, i) => ({ ...p, lineIndex: i })),
         InterpolationMethod.RBF,
         {
            basis: RBFBasis.THIN_PLATE, // Good for smooth sheets
            epsilon: 1.0,
            lambda: smoothingLambda, // Configurable smoothing factor
            power: 2,
            scaleX: config.scaleX,
            scaleY: config.scaleY
         }
       );

       // Resample points from the smooth surface
       combinedPointsData = combinedPointsData.map(p => ({
         ...p,
         pa: smoothInterpolator(p.fr, p.acc)
       }));
    }

    const finalText = combinedPointsData.map(p => `${p.pa.toFixed(4)},${p.fr},${p.acc}`).join('\n');
    setCombinedDataset(finalText);
    setShowCombineConfirm(true);
  };

  const handleConfirmCombine = () => {
    if (combinedDataset) {
      setState(prev => ({
        ...prev,
        datasets: prev.datasets.map(ds => {
            if (ds.id === 3) return { ...ds, text: combinedDataset, visible: true };
            return ds;
        }),
        activeDatasetId: 3
      }));
    }
    setShowCombineConfirm(false);
    setCombinedDataset(null);
  };

  const toggleVisibility = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setState(prev => {
      const newDatasets = [...prev.datasets];
      newDatasets[prev.datasets[id].visible && prev.datasets.filter(d => d.visible).length === 1 ? id : id] = { ...newDatasets[id], visible: !newDatasets[id].visible };
      // Prevent hiding the last visible dataset? No, let them do it if they want, but maybe warn?
      // Actually, the logic above was weird. Let's just toggle.
      newDatasets[id].visible = !prev.datasets[id].visible;
      return { ...prev, datasets: newDatasets };
    });
  };

  const handleImportFromCollection = () => {
    const { config: colConfig, grid } = collectionState;
    const { lineWidth, layerHeight, extrusionMultiplier } = colConfig;
    
    // Area = (Width - Height) * Height + PI * (Height/2)^2
    const area = ((lineWidth - layerHeight) * layerHeight) + (Math.PI * Math.pow(layerHeight / 2, 2));
    
    const newDatasetsText = ['', '', ''];

    Object.values(grid).forEach((cell: CollectionCell) => {
       // Flow = Speed * Area * ExtrusionMultiplier
       const flow = cell.speed * area * extrusionMultiplier;
       cell.paValues.forEach((paVal, idx) => {
          if (idx < 3 && paVal !== '' && !isNaN(parseFloat(paVal as string))) {
             const pa = parseFloat(paVal as string);
             const flowVal = parseFloat(flow.toFixed(2));
             const line = `${pa},${flowVal},${cell.accel}`;
             newDatasetsText[idx] += (newDatasetsText[idx] ? '\n' : '') + line;
          }
       });
    });

    setState(prev => ({
      ...prev,
      datasets: [
        { ...prev.datasets[0], text: newDatasetsText[0] || prev.datasets[0].text, visible: !!newDatasetsText[0] },
        { ...prev.datasets[1], text: newDatasetsText[1], visible: !!newDatasetsText[1] },
        { ...prev.datasets[2], text: newDatasetsText[2], visible: !!newDatasetsText[2] },
        prev.datasets[3] // Preserve Combined dataset
      ],
      activeDatasetId: 0
    }));
    
    setViewMode(ViewMode.VISUALIZER);
  };

  const activeDataset = state.datasets[state.activeDatasetId];

  // Push to Collection Logic
  const handlePushToCollection = () => {
    // Check which datasets have data
    const validDatasets = state.datasets.slice(0, 3).filter(ds => {
        const { points } = parseData(ds.text);
        return points.length > 0;
    }).map(ds => ds.id);

    if (validDatasets.length === 0) return;

    // Default to selecting the currently active one if valid, otherwise all valid ones?
    // Let's default to selecting the active one if it has data, or just the first valid one.
    const activeHasData = validDatasets.includes(state.activeDatasetId);
    setSelectedPushDatasets(activeHasData ? [state.activeDatasetId] : [validDatasets[0]]);
    
    setShowPushSelection(true);
  };

  const handleProceedWithPush = () => {
    setShowPushSelection(false);
    setIsChecking(true);

    // Add 1 second delay for "Checking Compatibility"
    setTimeout(() => {
        if (selectedPushDatasets.length === 0) {
            setIsChecking(false);
            return;
        }

        // 1. Collect all points from ALL selected datasets to determine the grid structure
        let allPoints: { fr: number, acc: number, pa: number, datasetId: number }[] = [];
        
        selectedPushDatasets.forEach(dsId => {
            const ds = state.datasets[dsId];
            const { points } = parseData(ds.text);
            points.forEach(p => {
                allPoints.push({ ...p, datasetId: dsId });
            });
        });
        
        if (allPoints.length === 0) {
            setIsChecking(false);
            return;
        }

        // Constants for calculation
        const layerHeight = 0.2; // Fixed
        const lineWidth = Math.round(pushConfig.nozzleSize * 1.125 * 10000) / 10000; // Round to 4 decimals
        const area = ((lineWidth - layerHeight) * layerHeight) + (Math.PI * Math.pow(layerHeight / 2, 2));
        
        // Back-calculate speeds and update points
        const processedPoints = allPoints.map(p => {
          // Flow = Speed * Area * ExtrusionMultiplier
          // Speed = Flow / (Area * ExtrusionMultiplier)
          const calculatedSpeed = p.fr / (area * pushConfig.flowRatio);
          // Round to nearest integer for cleaner UI/matching
          const roundedSpeed = Math.round(calculatedSpeed);
          // Also round acceleration to integer as per user request/standard
          const roundedAccel = Math.round(p.acc);
          return { ...p, fr: roundedSpeed, acc: roundedAccel };
        });

        // Extract unique speeds and accels from the AGGREGATE data
        const speeds = Array.from(new Set(processedPoints.map(p => p.fr))).sort((a, b) => a - b);
        const accels = Array.from(new Set(processedPoints.map(p => p.acc))).sort((a, b) => a - b);

        if (speeds.length < 2 || accels.length < 2) {
          setIsChecking(false);
          alert("Combined selection must have at least 2 unique speeds and 2 unique accelerations to define a grid.");
          return;
        }

        // Linearity Check Helper
        const isLinear = (values: number[]) => {
            if (values.length < 2) return true;
            const step = values[1] - values[0];
            // Allow a small tolerance of 1 due to potential rounding differences
            for (let i = 1; i < values.length; i++) {
                const diff = values[i] - values[i-1];
                if (Math.abs(diff - step) > 1) return false;
            }
            return true;
        };

        if (!isLinear(accels)) {
            setIsChecking(false);
            setLinearityError("Acceleration values do not have a linear step increment. The dataset is unable to be imported.");
            return;
        }

        if (!isLinear(speeds)) {
            setIsChecking(false);
            setLinearityError("Calculated Speed values do not have a linear step increment. The dataset is unable to be imported.");
            return;
        }

        // Calculate steps and range
        const speedMin = speeds[0];
        const speedMax = speeds[speeds.length - 1];
        const speedSteps = speeds.length;
        
        const accelMin = accels[0];
        const accelMax = accels[accels.length - 1];
        const accelSteps = accels.length;

        // Create new grid
        const newGrid: CollectionState['grid'] = {};
        
        // Initialize grid cells
        accels.forEach(acc => {
            speeds.forEach(spd => {
                newGrid[`${acc}-${spd}`] = {
                    accel: acc,
                    speed: spd,
                    paValues: [] // Initialize with empty array to allow dynamic sizing
                };
            });
        });

        // Populate grid with data from selected datasets
        processedPoints.forEach(p => {
            const key = `${p.acc}-${p.fr}`;
            if (newGrid[key]) {
                // Map datasetId (0, 1, 2) directly to paValues index
                // Set 1 (id 0) -> index 0
                // Set 2 (id 1) -> index 1
                // Set 3 (id 2) -> index 2
                if (p.datasetId >= 0 && p.datasetId < 3) {
                     const currentValues = [...newGrid[key].paValues];
                     currentValues[p.datasetId] = p.pa; // Assign to specific slot
                     newGrid[key] = {
                         ...newGrid[key],
                         paValues: currentValues
                     };
                }
            }
        });

        // Clean up sparse arrays to ensure no holes/undefined values
        Object.values(newGrid).forEach(cell => {
             for (let i = 0; i < cell.paValues.length; i++) {
                 if (cell.paValues[i] === undefined || cell.paValues[i] === null) {
                     cell.paValues[i] = '';
                 }
             }
        });

        const newConfig = {
          ...collectionState.config,
          speedMin,
          speedMax,
          speedSteps,
          accelMin,
          accelMax,
          accelSteps,
          nozzleSize: pushConfig.nozzleSize,
          extrusionMultiplier: pushConfig.flowRatio,
          lineWidth: lineWidth // Update derived lineWidth too
        };

        const candidate = { config: newConfig, grid: newGrid };

        // Check if collection is empty
        const isCollectionEmpty = Object.keys(collectionState.grid).length === 0;

        if (isCollectionEmpty) {
          // Direct populate
          setCollectionState({
            config: newConfig,
            grid: newGrid
          });
          setViewMode(ViewMode.COLLECTION);
          setIsChecking(false);
        } else {
          // Check compatibility
          const currentConfig = collectionState.config;
          const isCompatible = 
            currentConfig.speedMin === speedMin &&
            currentConfig.speedMax === speedMax &&
            currentConfig.speedSteps === speedSteps &&
            currentConfig.accelMin === accelMin &&
            currentConfig.accelMax === accelMax &&
            currentConfig.accelSteps === accelSteps;

          if (isCompatible) {
            // Merge logic
            setCollectionState(prev => {
                const updatedGrid = { ...prev.grid };
                
                Object.entries(newGrid).forEach(([key, cell]) => {
                    if (updatedGrid[key]) {
                        const existingValues = [...updatedGrid[key].paValues];
                        
                        // Only update slots that have data in the new grid
                        cell.paValues.forEach((val, idx) => {
                            if (val !== '' && val !== undefined) {
                                existingValues[idx] = val;
                            }
                        });

                        updatedGrid[key] = {
                            ...updatedGrid[key],
                            paValues: existingValues
                        };
                    } else {
                        updatedGrid[key] = cell;
                    }
                });
                
                return {
                    ...prev,
                    grid: updatedGrid
                };
            });
            setViewMode(ViewMode.COLLECTION);
            setIsChecking(false);
          } else {
            // Incompatible - Show Confirm
            setPushCandidateData(candidate);
            setShowPushConfirm(true);
            setIsChecking(false);
          }
        }
    }, 1000);
  };

  const handleConfirmPush = () => {
    if (pushCandidateData) {
      setCollectionState(pushCandidateData);
      setShowPushConfirm(false);
      setPushCandidateData(null);
      setViewMode(ViewMode.COLLECTION);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-200 font-sans selection:bg-blue-500/30">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm z-10">
        <div className="flex items-center gap-3">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 rounded-full blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
              <img src="opal-icon.svg" alt="OPAL Logo" className="relative w-10 h-10 object-contain" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-zinc-100 tracking-tight">OPAL</h1>
              <div className="flex items-center gap-2">
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-medium">Orcaslicer Pressure Advance Lab</p>
                <span className="text-[9px] text-zinc-600 font-mono border border-zinc-800 px-1 rounded">v1.0.1-rc2</span>
              </div>
            </div>
        </div>
        
        {/* View Switcher */}
        <div className="flex bg-zinc-900 rounded-lg p-1 border border-zinc-800">
           <button
             onClick={() => setViewMode(ViewMode.COLLECTION)}
             className={`px-4 py-1.5 text-xs font-medium rounded transition-all ${viewMode === ViewMode.COLLECTION ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
           >
             Data Collection Table
           </button>
           <button
             onClick={() => setViewMode(ViewMode.VISUALIZER)}
             className={`px-4 py-1.5 text-xs font-medium rounded transition-all ${viewMode === ViewMode.VISUALIZER ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
           >
             3D Visualizer
           </button>
        </div>

        <div className="flex gap-2">
           {viewMode === ViewMode.COLLECTION && (
             <button
               onClick={handleImportFromCollection}
               className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded shadow-lg shadow-emerald-900/20 transition-colors flex items-center gap-2"
             >
               <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
               Push current table to visualizer
             </button>
           )}
           <button
             onClick={requestClear}
             className="px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors"
           >
             Clear Data
           </button>
        </div>
      </header>

      {/* Main Layout */}
      <main className="flex-1 flex min-h-0 overflow-hidden">
        
        {viewMode === ViewMode.COLLECTION ? (
          <div className="w-full h-full">
            <DataCollection key={collectionResetKey} state={collectionState} onChange={setCollectionState} resetKey={collectionResetKey} />
          </div>
        ) : (
          <>
            {/* Left Sidebar: Code Editor */}
            <aside 
              className="flex flex-col border-r border-zinc-800 bg-zinc-900/20 transition-all duration-300 ease-in-out"
              style={{ width: sidebarWidth }}
            >

              {/* Tabs */}
              <div className="grid grid-cols-2 border-b border-zinc-800 bg-zinc-900/40">
                {state.datasets.map((ds, idx) => (
                  <div
                    key={ds.id}
                    onClick={() => setState(s => ({ ...s, activeDatasetId: ds.id }))}
                    className={`
                      flex items-center justify-center gap-2 py-2 text-xs font-medium cursor-pointer transition-colors
                      ${idx % 2 === 0 ? 'border-r border-zinc-800' : ''}
                      ${idx < 2 ? 'border-b border-zinc-800' : ''}
                      ${state.activeDatasetId === ds.id ? 'bg-zinc-800/50 text-white' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30'}
                    `}
                  >
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: ds.color }}
                    />
                    {ds.name}
                    <div
                      onClick={(e) => toggleVisibility(ds.id, e)}
                      className={`
                        ml-1 w-4 h-4 rounded border flex items-center justify-center transition-colors
                        ${ds.visible ? 'bg-blue-600 border-blue-600 text-white' : 'border-zinc-600 hover:border-zinc-400'}
                      `}
                    >
                      {ds.visible && <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center p-4 pb-2">
                 <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Input Data ({activeDataset.name})</label>
                 <span className="text-[10px] text-zinc-600">Format: PA, Flow, Accel</span>
              </div>
              <div className="flex-1 overflow-hidden p-4 pt-0 flex flex-col gap-2">
                <div className="flex-1 min-h-0">
                  <CodeEditor
                    value={activeDataset.text}
                    onChange={handleTextChange}
                    highlightLineIndex={state.selectedPoint?.datasetId === state.activeDatasetId ? state.selectedPoint.lineIndex : null}
                    errors={activeDataset.errors}
                  />
                </div>
                <button
                  onClick={handlePushToCollection}
                  disabled={activeDataset.points.length === 0}
                  className="w-full py-2 text-xs font-bold text-white bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed rounded border border-zinc-700 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                  Push to Collection Table
                </button>
              </div>
            </aside>

            {/* Center: 3D Plot */}
            <section className="flex-1 relative bg-zinc-950 flex flex-col">
               {/* Combine Toolbar */}
               <div className="flex items-center gap-4 px-4 py-2 bg-zinc-900/80 border-b border-zinc-800 backdrop-blur-sm z-20">
                  <button
                    onClick={handleCombine}
                    className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded shadow-lg shadow-blue-900/20 transition-colors flex items-center gap-2"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                    Combine Visible
                  </button>

                  <div className="h-6 w-px bg-zinc-700 mx-2"></div>

                  <label className="flex items-center gap-2 cursor-pointer group">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={useSmoothing}
                        onChange={(e) => setUseSmoothing(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-zinc-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                    </div>
                    <span className="text-xs font-medium text-zinc-400 group-hover:text-zinc-200 transition-colors">Weighted Smoothing</span>
                  </label>

                  {useSmoothing && (
                    <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-4 duration-300">
                       <span className="text-[10px] font-mono text-zinc-500">LAMBDA: {smoothingLambda.toFixed(3)}</span>
                       <input
                         type="range"
                         min="0.001"
                         max="0.1"
                         step="0.001"
                         value={smoothingLambda}
                         onChange={(e) => setSmoothingLambda(parseFloat(e.target.value))}
                         className="w-32 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                       />
                    </div>
                  )}
               </div>

               <div className="flex-1 relative p-2">
                 <Plot3D
                   datasets={state.datasets}
                   config={config}
                   onSelectPoint={(datasetId, lineIdx) => setState(s => ({ ...s, selectedPoint: { datasetId, lineIndex: lineIdx } }))}
                   selectedPoint={state.selectedPoint}
                   onUpdatePoint={handlePointUpdate}
                 />
                 {/* Overlay Info */}
                 <div className="absolute top-4 left-4 pointer-events-none opacity-50">
                    <div className="text-[10px] text-zinc-500 font-mono">
                       Active: {activeDataset.name} <br/>
                       PTS: {activeDataset.points.length} <br/>
                       Z-RNG: {config.zMin.toFixed(3)} - {config.zMax.toFixed(3)}
                    </div>
                 </div>
               </div>
            </section>

            {/* Right Sidebar: Controls */}
            <aside className="w-[300px] border-l border-zinc-800 bg-zinc-900/30 flex flex-col">
               <div className="p-4 border-b border-zinc-800">
                 <h2 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Configuration</h2>
               </div>
               <div className="flex-1 overflow-hidden p-2">
                 <Controls config={config} onChange={setConfig} />
               </div>
            </aside>
          </>
        )}
      </main>

      {/* Confirmation Dialog */}
      {showCombineConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-white mb-2">Confirm Surface Combination</h3>
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 mb-4">
              <p className="text-xs text-yellow-200 leading-relaxed">
                ⚠️ The resulting dataset might be significantly different from optimal calibration values.
                The values should be verified with test prints and inspected for any quality issues.
              </p>
            </div>

            <div className="mb-6 space-y-3">
              <p className="text-sm text-zinc-400">
                This action will average the visible surfaces into the <b>Combined</b> dataset tab.
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowCombineConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmCombine}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-lg shadow-blue-900/20 transition-colors"
              >
                Accept & Combine
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Push Selection & Configuration Dialog */}
      {showPushSelection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-white mb-4">Push data to collection table</h3>
            
            <div className="space-y-6 mb-6">
               {/* Dataset Selection */}
               <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Select Datasets to Push</label>
                  <div className="grid grid-cols-1 gap-2">
                    {state.datasets.slice(0, 3).map((ds) => {
                        const hasData = parseData(ds.text).points.length > 0;
                        return (
                            <label key={ds.id} className={`flex items-center gap-3 p-2 rounded border ${selectedPushDatasets.includes(ds.id) ? 'bg-blue-500/10 border-blue-500/50' : 'bg-zinc-950 border-zinc-800'} ${!hasData ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-zinc-600'} transition-colors`}>
                                <input
                                    type="checkbox"
                                    checked={selectedPushDatasets.includes(ds.id)}
                                    disabled={!hasData}
                                    onChange={(e) => {
                                        if (e.target.checked) {
                                            setSelectedPushDatasets(prev => [...prev, ds.id]);
                                        } else {
                                            setSelectedPushDatasets(prev => prev.filter(id => id !== ds.id));
                                        }
                                    }}
                                    className="w-4 h-4 rounded border-zinc-600 text-blue-600 focus:ring-blue-500 bg-zinc-900"
                                />
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ds.color }} />
                                    <span className="text-sm font-medium text-zinc-200">{ds.name}</span>
                                    {!hasData && <span className="text-[10px] text-zinc-500 italic">(No Data)</span>}
                                </div>
                            </label>
                        );
                    })}
                  </div>
                  <p className="text-[10px] text-zinc-500">
                    Selected datasets will be moved to the collection table into their corresponding colored input fields.
                  </p>
               </div>

               {/* Print Config */}
               <div className="space-y-2 pt-4 border-t border-zinc-800">
                   <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Print Configuration</label>
                   <p className="text-[10px] text-zinc-500 mb-2">
                     Required to calculate print speeds from flow rates.
                   </p>
                   
                   <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1">
                       <label className="text-xs text-zinc-500">Nozzle Diameter (mm)</label>
                       <input 
                         type="number" 
                         step="0.1"
                         min="0.1"
                         max="2.0"
                         value={pushConfig.nozzleSize}
                         onChange={(e) => {
                           let val = parseFloat(e.target.value);
                           if (val > 2.0) val = 2.0;
                           if (val < 0.1 && e.target.value !== "") val = 0.1;
                           setPushConfig(c => ({ ...c, nozzleSize: val }))
                         }}
                         className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-zinc-200 focus:border-blue-500 outline-none"
                       />
                     </div>
                     <div className="space-y-1">
                       <label className="text-xs text-zinc-500">Flow Ratio</label>
                       <input 
                         type="number" 
                         step="0.01"
                         value={pushConfig.flowRatio}
                         onChange={(e) => setPushConfig(c => ({ ...c, flowRatio: parseFloat(e.target.value) }))}
                         className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-zinc-200 focus:border-blue-500 outline-none"
                       />
                     </div>
                   </div>
               </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowPushSelection(false)}
                className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleProceedWithPush}
                disabled={selectedPushDatasets.length === 0}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-lg shadow-blue-900/20 transition-colors"
              >
                Push Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Data Confirmation Dialog */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-white mb-2">Clear Data?</h3>
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
              <p className="text-xs text-red-200 leading-relaxed">
                ⚠️ This will permanently erase all data in the current view.
                {viewMode === ViewMode.COLLECTION 
                    ? " All values in the collection table will be cleared." 
                    : " All datasets in the visualizer will be cleared."}
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={viewMode === ViewMode.COLLECTION ? handleClearCollection : () => { handleClearVisualizer(); setShowClearConfirm(false); }}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-500 rounded-lg shadow-lg shadow-red-900/20 transition-colors"
              >
                Clear All Data
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Push Confirmation Dialog */}
      {showPushConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-white mb-2">Incompatible Data</h3>
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
              <p className="text-xs text-red-200 leading-relaxed">
                ⚠️ The dataset you are trying to push has different Speed/Acceleration values than the current Data Collection table.
              </p>
            </div>

            <div className="mb-6 space-y-3">
              <p className="text-sm text-zinc-400">
                Pushing this data will <b>CLEAR</b> the existing table and reconfigure it to match the new dataset.
              </p>
              <p className="text-sm text-zinc-400">
                Are you sure you want to proceed?
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowPushConfirm(false);
                  setPushCandidateData(null);
                }}
                className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmPush}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-500 rounded-lg shadow-lg shadow-red-900/20 transition-colors"
              >
                Confirm & Overwrite
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Loading Spinner Overlay */}
      {isChecking && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
            <div className="text-sm font-medium text-blue-400 animate-pulse">Checking for range compatibility...</div>
          </div>
        </div>
      )}

      {/* Linearity Error Modal */}
      {linearityError && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-red-500/30 rounded-xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-red-400 mb-2 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              Import Failed
            </h3>
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
              <p className="text-xs text-red-200 leading-relaxed">
                {linearityError}
              </p>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setLinearityError(null)}
                className="px-4 py-2 text-sm font-medium text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;