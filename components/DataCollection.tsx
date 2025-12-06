import React, { useEffect, useMemo } from "react";
import { CollectionState, CollectionCell } from "../types";
import { generateSteps } from "../services/dataUtils";

interface DataCollectionProps {
  state: CollectionState;
  onChange: (newState: CollectionState) => void;
  resetKey?: number;
}

const BG_COLORS = ["bg-blue-500/20", "bg-red-500/20", "bg-emerald-500/20"];

interface NumberInputProps {
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  allowInfinity?: boolean;
}

const NumberInput: React.FC<NumberInputProps> = ({
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  className = "",
  allowInfinity = false,
}) => {
  const [inputValue, setInputValue] = React.useState<string>(value.toString());
  const [isEditing, setIsEditing] = React.useState(false);

  // Sync internal state when prop value changes (unless we are editing)
  React.useEffect(() => {
    if (!isEditing) {
      setInputValue(allowInfinity && value === 0 ? "∞" : value.toString());
    }
  }, [value, isEditing, allowInfinity]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setIsEditing(true);
  };

  const handleConfirm = () => {
    let val = inputValue;
    if (allowInfinity && (val === "" || val === "∞")) {
      onChange(0);
      setIsEditing(false);
      return;
    }

    let num = parseFloat(val);
    if (isNaN(num)) {
      // Revert if invalid
      handleRevert();
      return;
    }

    // Validation
    if (min !== undefined && num < min) {
      // Clamp to min
      num = min;
    }
    if (max !== undefined && num > max) {
      // Clamp to max
      num = max;
    }

    onChange(num);
    setInputValue(num.toString());
    setIsEditing(false);
  };

  const handleRevert = () => {
    setInputValue(allowInfinity && value === 0 ? "∞" : value.toString());
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleConfirm();
    } else if (e.key === "Escape") {
      handleRevert();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      handleIncrement();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      handleDecrement();
    }
  };

  const handleIncrement = () => {
    // If editing, use current input value as base
    const currentVal = parseFloat(inputValue) || value;
    const next = currentVal + step;
    if (max !== undefined && next > max) return;

    const nextVal = parseFloat(next.toFixed(4));
    setInputValue(nextVal.toString());
    setIsEditing(true);
  };

  const handleDecrement = () => {
    const currentVal = parseFloat(inputValue) || value;
    const next = currentVal - step;
    if (min !== undefined && next < min) {
      if (allowInfinity && min === 0) {
        setInputValue("∞");
        setIsEditing(true);
      }
      return;
    }
    const nextVal = parseFloat(next.toFixed(4));
    setInputValue(nextVal.toString());
    setIsEditing(true);
  };

  return (
    <div className={`relative flex items-center ${className}`}>
      <input 
        type="text" 
        value={inputValue} 
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => {
            // Optional: Auto-confirm on blur? 
            // The user requested explicit check/x buttons, so maybe we shouldn't auto-confirm on blur 
            // to allow them to see the buttons. 
            // However, standard UX often confirms on blur. 
            // Let's stick to explicit buttons for now as requested, 
            // but maybe revert if they leave the field without confirming?
            // For now, let's leave it in editing state so they see the buttons.
        }}
        className={`w-full bg-transparent text-xs focus:outline-none font-mono ${isEditing ? 'pr-16 text-yellow-400' : 'pr-4 text-zinc-200'}`}
      />
      
      <div className="absolute right-0 flex items-center bg-zinc-900/80 pl-1 gap-1">
        {isEditing && (
            <div className="flex items-center gap-1">
                <button 
                  onClick={handleConfirm}
                  className="text-emerald-500 hover:text-emerald-400 leading-none px-0.5"
                  title="Confirm"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                </button>
                <button 
                  onClick={handleRevert}
                  className="text-red-500 hover:text-red-400 leading-none px-0.5"
                  title="Revert"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
        )}
        
        <div className="flex flex-col -mr-1">
            <button 
              onClick={handleIncrement}
              className="text-zinc-500 hover:text-zinc-300 leading-none px-1"
            >
              <svg className="w-2 h-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" /></svg>
            </button>
            <button 
              onClick={handleDecrement}
              className="text-zinc-500 hover:text-zinc-300 leading-none px-1"
            >
              <svg className="w-2 h-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
            </button>
        </div>
      </div>
    </div>
  );
};

export const DataCollection: React.FC<DataCollectionProps> = ({
  state,
  onChange,
  resetKey = 0,
}) => {
  const { config, grid } = state;

  const accelValues = useMemo(
    () => generateSteps(config.accelMin, config.accelMax, config.accelSteps, 0),
    [config.accelMin, config.accelMax, config.accelSteps]
  );
  const speedValues = useMemo(
    () => generateSteps(config.speedMin, config.speedMax, config.speedSteps, 0),
    [config.speedMin, config.speedMax, config.speedSteps]
  );

  // Generate Batches
  const batches = useMemo(() => {
    const totalPatterns = accelValues.length * speedValues.length;
    const max = config.maxPatterns;

    if (max <= 0 || totalPatterns <= max) {
      return [{ id: 1, accels: accelValues, speeds: speedValues }];
    }

    const batchesList: { id: number; accels: number[]; speeds: number[] }[] =
      [];
    let batchId = 1;
    const accelLen = accelValues.length;
    const speedLen = speedValues.length;

    // Calculate optimal chunk sizes to maintain aspect ratio
    let sChunk = Math.floor(Math.sqrt((max * speedLen) / accelLen));
    if (sChunk < 1) sChunk = 1;
    let aChunk = Math.floor(max / sChunk);
    if (aChunk < 1) aChunk = 1;

    // Ensure we don't exceed max (integer math safety)
    while (sChunk * aChunk > max) {
      if (sChunk > aChunk) sChunk--;
      else aChunk--;
    }

    for (let i = 0; i < accelLen; i += aChunk) {
      for (let j = 0; j < speedLen; j += sChunk) {
        const batchAccels = accelValues.slice(i, i + aChunk);
        const batchSpeeds = speedValues.slice(j, j + sChunk);

        if (batchAccels.length > 0 && batchSpeeds.length > 0) {
          batchesList.push({
            id: batchId++,
            accels: batchAccels,
            speeds: batchSpeeds,
          });
        }
      }
    }
    return batchesList;
  }, [accelValues, speedValues, config.maxPatterns]);

  // Calculate Flow Rate using Ellis' script formula (Stadium Shape Area)
  const calculateFlow = (speed: number) => {
    const { lineWidth, layerHeight, extrusionMultiplier } = config;
    // Area = (Width - Height) * Height + PI * (Height/2)^2
    const area =
      (lineWidth - layerHeight) * layerHeight +
      Math.PI * Math.pow(layerHeight / 2, 2);
    // Flow = Speed * Area * ExtrusionMultiplier
    return speed * area * extrusionMultiplier;
  };

  // Update grid keys when config changes (preserve existing data if key matches)
  useEffect(() => {
    const newGrid: Record<string, CollectionCell> = {};
    let hasChanges = false;

    accelValues.forEach((accel) => {
      speedValues.forEach((speed) => {
        const key = `${accel}-${speed}`;
        if (grid[key]) {
          newGrid[key] = grid[key];
        } else {
          newGrid[key] = { accel, speed, paValues: [""] };
          hasChanges = true;
        }
      });
    });

    if (hasChanges) {
      // We need to defer this update to avoid "cannot update during render" if this effect runs synchronously?
      // useEffect runs after render, so it's safe to call onChange (which sets state in parent).
      // However, we should be careful about infinite loops.
      // hasChanges is only true if keys were missing.
      // Next render, keys will be present, so hasChanges will be false.
      onChange({
        ...state,
        grid: newGrid,
      });
    }
  }, [accelValues, speedValues]); // Removed grid from dependencies to prevent circular updates/fighting with clear

  const handleConfigChange = (field: keyof typeof config, value: number) => {
    // Prevent negative values
    if (value < 0) return;

    let newConfig = { ...config, [field]: value };

    // Auto-update line width if nozzle size changes (default to 112.5% as per script)
    if (field === "nozzleSize") {
      newConfig.lineWidth = value * 1.125;
    }

    onChange({
      ...state,
      config: newConfig,
    });
  };

  const updateConfig = (field: keyof typeof config, value: number) => {
    handleConfigChange(field, value);
  };

  const handlePaChange = (
    accel: number,
    speed: number,
    index: number,
    value: string
  ) => {
    const key = `${accel}-${speed}`;
    const cell = state.grid[key] || { accel, speed, paValues: [""] };
    const newPaValues = [...cell.paValues];
    newPaValues[index] = value;

    onChange({
      ...state,
      grid: {
        ...state.grid,
        [key]: { ...cell, paValues: newPaValues },
      },
    });
  };

  const addPaValue = (accel: number, speed: number) => {
    const key = `${accel}-${speed}`;
    const cell = state.grid[key] || { accel, speed, paValues: [""] };
    if (cell.paValues.length >= 3) return;

    onChange({
      ...state,
      grid: {
        ...state.grid,
        [key]: { ...cell, paValues: [...cell.paValues, ""] },
      },
    });
  };

  const removePaValue = (accel: number, speed: number, index: number) => {
    const key = `${accel}-${speed}`;
    const cell = state.grid[key];
    if (!cell || cell.paValues.length <= 1) return; // Keep at least one

    const newPaValues = cell.paValues.filter((_, i) => i !== index);
    onChange({
      ...state,
      grid: {
        ...state.grid,
        [key]: { ...cell, paValues: newPaValues },
      },
    });
  };

  // Create a lookup for batch ID by accel/speed
  const batchLookup = useMemo(() => {
    const lookup: Record<string, number> = {};
    batches.forEach((batch) => {
      batch.accels.forEach((a) => {
        batch.speeds.forEach((s) => {
          lookup[`${a}-${s}`] = batch.id;
        });
      });
    });
    return lookup;
  }, [batches]);

  // Pre-calculate row groupings for the Batch column
  const rowGroups = useMemo(() => {
    const groups: { batchIds: string; count: number; startIndex: number }[] =
      [];
    if (speedValues.length === 0) return groups;

    let currentBatchIds = "";
    let currentCount = 0;
    let startIndex = 0;

    speedValues.forEach((speed, index) => {
      // Determine unique batch IDs for this row
      const rowBatchIds = Array.from(
        new Set(
          accelValues
            .map((accel) => batchLookup[`${accel}-${speed}`])
            .filter((id) => id !== undefined)
        )
      )
        .sort()
        .join(", ");

      if (index === 0) {
        currentBatchIds = rowBatchIds;
        currentCount = 1;
        startIndex = 0;
      } else if (rowBatchIds === currentBatchIds) {
        currentCount++;
      } else {
        groups.push({
          batchIds: currentBatchIds,
          count: currentCount,
          startIndex,
        });
        currentBatchIds = rowBatchIds;
        currentCount = 1;
        startIndex = index;
      }
    });
    // Push the last group
    groups.push({ batchIds: currentBatchIds, count: currentCount, startIndex });
    return groups;
  }, [speedValues, accelValues, batchLookup]);

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-200">
      {/* Top Bar: Configuration */}
      <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 flex flex-col gap-3">
        {/* Acceleration Config */}
        <div className="flex items-center gap-4">
          <h3 className="w-28 text-xs font-bold text-blue-400 uppercase tracking-wider shrink-0">
            Acceleration{" "}
            <span className="text-zinc-600 normal-case">(mm/s²)</span>
          </h3>
          <div className="flex-1 grid grid-cols-3 gap-4">
            <div className="flex items-center gap-2 bg-zinc-900/50 p-1.5 rounded border border-zinc-800">
              <label className="text-[10px] text-zinc-500 w-8 font-medium">
                Min:
              </label>
              <NumberInput
                value={config.accelMin}
                onChange={(val) => handleConfigChange("accelMin", val)}
                className="flex-1"
                step={100}
                max={config.accelMax}
              />
            </div>
            <div className="flex items-center gap-2 bg-zinc-900/50 p-1.5 rounded border border-zinc-800">
              <label className="text-[10px] text-zinc-500 w-8 font-medium">
                Max:
              </label>
              <NumberInput
                value={config.accelMax}
                onChange={(val) => handleConfigChange("accelMax", val)}
                className="flex-1"
                step={100}
                min={config.accelMin}
              />
            </div>
            <div className="flex items-center gap-2 bg-zinc-900/50 p-1.5 rounded border border-zinc-800">
              <label className="text-[10px] text-zinc-500 w-8 font-medium">
                Steps:
              </label>
              <NumberInput
                value={config.accelSteps}
                onChange={(val) => handleConfigChange("accelSteps", val)}
                className="flex-1"
                min={2}
              />
            </div>
          </div>
        </div>

        {/* Speed Config */}
        <div className="flex items-center gap-4">
          <h3 className="w-28 text-xs font-bold text-emerald-400 uppercase tracking-wider shrink-0">
            Speed <span className="text-zinc-600 normal-case">(mm/s)</span>
          </h3>
          <div className="flex-1 grid grid-cols-3 gap-4">
            <div className="flex items-center gap-2 bg-zinc-900/50 p-1.5 rounded border border-zinc-800">
              <label className="text-[10px] text-zinc-500 w-8 font-medium">
                Min:
              </label>
              <NumberInput
                value={config.speedMin}
                onChange={(val) => handleConfigChange("speedMin", val)}
                className="flex-1"
                step={5}
                max={config.speedMax}
              />
            </div>
            <div className="flex items-center gap-2 bg-zinc-900/50 p-1.5 rounded border border-zinc-800">
              <label className="text-[10px] text-zinc-500 w-8 font-medium">
                Max:
              </label>
              <NumberInput
                value={config.speedMax}
                onChange={(val) => handleConfigChange("speedMax", val)}
                className="flex-1"
                step={5}
                min={config.speedMin}
              />
            </div>
            <div className="flex items-center gap-2 bg-zinc-900/50 p-1.5 rounded border border-zinc-800">
              <label className="text-[10px] text-zinc-500 w-8 font-medium">
                Steps:
              </label>
              <NumberInput
                value={config.speedSteps}
                onChange={(val) => handleConfigChange("speedSteps", val)}
                className="flex-1"
                min={2}
              />
            </div>
          </div>
        </div>

        {/* Printer Config */}
        <div className="flex items-start gap-4">
          <h3 className="w-28 text-xs font-bold text-purple-400 uppercase tracking-wider shrink-0 pt-2">
            Printer
          </h3>
          <div className="flex-1 grid grid-cols-3 gap-4">
            {/* Column 1: Nozzle & Flow Ratio */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 bg-zinc-900/50 p-1.5 rounded border border-zinc-800">
                <label className="text-[10px] text-zinc-500 w-24 font-medium whitespace-nowrap">
                  Nozzle Diameter:
                </label>
                <div className="relative flex items-center flex-1">
                  <input
                    type="number"
                    value={config.nozzleSize}
                    onChange={(e) => {
                      let val = parseFloat(e.target.value);
                      if (val > 2.0) val = 2.0;
                      if (val < 0.1 && e.target.value !== "") val = 0.1;
                      handleConfigChange("nozzleSize", val);
                    }}
                    step={0.1}
                    min={0.1}
                    max={2.0}
                    className="w-full bg-transparent text-xs focus:outline-none text-zinc-300 font-mono pr-4"
                  />
                  <div className="flex flex-col -mr-1">
                    <button
                      onClick={() => {
                        let val = config.nozzleSize + 0.1;
                        if (val > 2.0) val = 2.0;
                        handleConfigChange("nozzleSize", parseFloat(val.toFixed(2)));
                      }}
                      className="text-zinc-500 hover:text-blue-400 leading-none px-1"
                    >
                      <svg className="w-2 h-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" /></svg>
                    </button>
                    <button
                      onClick={() => {
                        let val = config.nozzleSize - 0.1;
                        if (val < 0.1) val = 0.1;
                        handleConfigChange("nozzleSize", parseFloat(val.toFixed(2)));
                      }}
                      className="text-zinc-500 hover:text-blue-400 leading-none px-1"
                    >
                      <svg className="w-2 h-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-zinc-900/50 p-1.5 rounded border border-zinc-800">
                <label className="text-[10px] text-zinc-500 w-24 font-medium whitespace-nowrap">
                  Filament Flow Ratio:
                </label>
                <NumberInput
                  value={config.extrusionMultiplier}
                  onChange={(val) =>
                    handleConfigChange("extrusionMultiplier", val)
                  }
                  className="flex-1"
                  step={0.01}
                />
              </div>
            </div>

            {/* Column 2: Layer Height & Line Width */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 bg-zinc-900/50 p-1.5 rounded border border-zinc-800 relative group">
                <label className="text-[10px] text-zinc-500 w-20 font-medium whitespace-nowrap flex items-center gap-1">
                  Layer Height:
                  <div className="group/tooltip relative">
                    <svg className="w-3 h-3 text-yellow-600/50 hover:text-yellow-500 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-zinc-900 border border-yellow-900/30 rounded shadow-xl text-[10px] text-zinc-400 leading-tight hidden group-hover/tooltip:block z-[100] pointer-events-none whitespace-normal">
                      <span className="text-yellow-500 font-bold block mb-1">Warning</span>
                      These values must be manually configured in your slicer settings before printing. The Orca pattern generator defaults to 0.2mm/0.45mm after each generation, so you must verify this matches every time.
                    </div>
                  </div>
                </label>
                <NumberInput
                  value={config.layerHeight}
                  onChange={(val) => handleConfigChange("layerHeight", val)}
                  className="flex-1"
                  step={0.04}
                />
              </div>
              <div className="flex items-center gap-2 bg-zinc-900/50 p-1.5 rounded border border-zinc-800 relative group">
                <label className="text-[10px] text-zinc-500 w-20 font-medium whitespace-nowrap flex items-center gap-1">
                  Line Width:
                  <div className="group/tooltip relative">
                    <svg className="w-3 h-3 text-yellow-600/50 hover:text-yellow-500 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-zinc-900 border border-yellow-900/30 rounded shadow-xl text-[10px] text-zinc-400 leading-tight hidden group-hover/tooltip:block z-[100] pointer-events-none whitespace-normal">
                      <span className="text-yellow-500 font-bold block mb-1">Warning</span>
                      These values must be updated in your slicer settings manually before printing. The pattern generator defaults to 0.2mm/0.45mm every time, so you must verify this for each new batch.
                    </div>
                  </div>
                </label>
                <NumberInput
                  value={parseFloat(config.lineWidth.toFixed(4))}
                  onChange={(val) => handleConfigChange("lineWidth", val)}
                  className="flex-1"
                  step={0.01}
                />
              </div>
            </div>

            {/* Column 3: Volumetric Flow Min & Max & Max Patterns */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 bg-zinc-800 p-1.5 rounded border border-zinc-700">
                <label className="text-[10px] text-zinc-400 w-28 font-medium whitespace-nowrap">
                  Volumetric Flow Min:
                </label>
                <input
                  type="text"
                  value={calculateFlow(config.speedMin).toFixed(2)}
                  readOnly
                  className="w-full bg-transparent text-xs focus:outline-none text-zinc-400 font-mono cursor-not-allowed"
                />
              </div>
              <div className="flex items-center gap-2 bg-zinc-800 p-1.5 rounded border border-zinc-700">
                <label className="text-[10px] text-zinc-400 w-28 font-medium whitespace-nowrap">
                  Volumetric Flow Max:
                </label>
                <input
                  type="text"
                  value={calculateFlow(config.speedMax).toFixed(2)}
                  readOnly
                  className="w-full bg-transparent text-xs focus:outline-none text-zinc-400 font-mono cursor-not-allowed"
                />
              </div>
              <div className="flex items-center gap-2 bg-zinc-900/50 p-1.5 rounded border border-zinc-800">
                <label className="text-[10px] text-zinc-500 w-28 font-medium whitespace-nowrap">
                  Max Patterns/Print:
                </label>
                <NumberInput
                  value={config.maxPatterns}
                  onChange={(val) => handleConfigChange("maxPatterns", val)}
                  className="flex-1"
                  allowInfinity={true}
                />
              </div>
            </div>
          </div>
        </div>

        {/* PA Pattern Input Values */}
        <div className="flex flex-col gap-2 pt-2 border-t border-zinc-800/50">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
              PA Pattern Input Values
            </h3>
            {batches.length > 1 && (
              <span className="text-[10px] text-blue-400 font-mono">
                {batches.length} Batches
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            {batches.map((batch) => {
              // Check completion status for this batch
              const completionStatus = [true, true, true];
              // Only check datasets that actually exist in the grid (based on max length of paValues found or just check all 3 slots?)
              // The user wants to know if "corresponding values... have been filled".
              // We'll check all 3 slots. If a slot is empty string, it's incomplete.

              for (const accel of batch.accels) {
                for (const speed of batch.speeds) {
                  const key = `${accel}-${speed}`;
                  const cell = grid[key];
                  if (!cell) {
                    completionStatus[0] = false;
                    completionStatus[1] = false;
                    completionStatus[2] = false;
                    break;
                  }
                  for (let i = 0; i < 3; i++) {
                    if (!cell.paValues[i] || cell.paValues[i] === "") {
                      completionStatus[i] = false;
                    }
                  }
                }
              }

              return (
                <div
                  key={batch.id}
                  className="space-y-1 bg-zinc-900/30 p-2 rounded border border-zinc-800/50 w-fit max-w-full"
                >
                  <div className="flex items-center justify-between gap-4 min-h-[16px]">
                    {batches.length > 1 ? (
                      <div className="text-[10px] font-bold text-zinc-600">
                        Batch {batch.id}
                      </div>
                    ) : (
                      <div></div>
                    )}

                    <div className="flex gap-1">
                      {completionStatus.map((isComplete, idx) => {
                        const colors = [
                          "bg-blue-500",
                          "bg-red-500",
                          "bg-emerald-500",
                        ];
                        const borderColors = [
                          "border-blue-500/50",
                          "border-red-500/50",
                          "border-emerald-500/50",
                        ];

                        return (
                          <div
                            key={idx}
                            className={`w-3 h-3 rounded-sm flex items-center justify-center border ${
                              borderColors[idx]
                            } ${isComplete ? colors[idx] : "bg-transparent"}`}
                          >
                            {isComplete && (
                              <svg
                                className="w-2.5 h-2.5 text-white"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={4}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-1">
                    <div className="flex items-center justify-between gap-2 bg-zinc-800 p-1.5 rounded border border-zinc-700 max-w-full">
                      <label className="text-[10px] text-zinc-400 font-medium shrink-0">
                        Accelerations:
                      </label>
                      <span
                        className="text-xs text-zinc-400 font-mono cursor-pointer hover:text-zinc-200 transition-colors truncate text-right"
                        onClick={(e) => {
                          const range = document.createRange();
                          range.selectNodeContents(e.currentTarget);
                          const sel = window.getSelection();
                          sel?.removeAllRanges();
                          sel?.addRange(range);
                          navigator.clipboard.writeText(batch.accels.join(","));
                        }}
                      >
                        {batch.accels.join(",")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 bg-zinc-800 p-1.5 rounded border border-zinc-700 max-w-full">
                      <label className="text-[10px] text-zinc-400 font-medium shrink-0">
                        Speeds:
                      </label>
                      <span
                        className="text-xs text-zinc-400 font-mono cursor-pointer hover:text-zinc-200 transition-colors truncate text-right"
                        onClick={(e) => {
                          const range = document.createRange();
                          range.selectNodeContents(e.currentTarget);
                          const sel = window.getSelection();
                          sel?.removeAllRanges();
                          sel?.addRange(range);
                          navigator.clipboard.writeText(batch.speeds.join(","));
                        }}
                      >
                        {batch.speeds.join(",")}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Grid Area */}
      <div className="flex-1 overflow-auto px-6 pb-6">
        <div className="inline-block min-w-full align-middle pt-6">
          <table className="min-w-full border-collapse">
            <thead>
              <tr>
                {/* Batch Header */}
                <th className="sticky top-0 left-0 z-50 bg-zinc-900 p-2 border border-zinc-800 text-[10px] text-zinc-500 uppercase tracking-wider w-10 text-center">
                  #
                </th>
                <th className="sticky top-0 left-10 z-50 bg-zinc-900 p-2 border border-zinc-800 text-[10px] text-zinc-500 uppercase tracking-wider">
                  Speed \ Accel
                </th>
                {accelValues.map((accel) => (
                  <th
                    key={accel}
                    className="sticky top-0 z-40 bg-zinc-900 p-2 border border-zinc-800 min-w-[180px]"
                  >
                    <div className="text-xs font-bold text-blue-400">
                      {accel}
                    </div>
                    <div className="text-[10px] text-zinc-600 font-normal">
                      mm/s²
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {speedValues.map((speed, speedIndex) => {
                const flow = calculateFlow(speed);

                // Determine if this row (speed) belongs to a batch that covers ALL accels
                // If so, we can outline the header too.
                // Check if the first accel's batch is the same as the last accel's batch
                const firstAccelBatch =
                  batchLookup[`${accelValues[0]}-${speed}`];
                const lastAccelBatch =
                  batchLookup[
                    `${accelValues[accelValues.length - 1]}-${speed}`
                  ];
                const rowIsSingleBatch =
                  firstAccelBatch === lastAccelBatch &&
                  firstAccelBatch !== undefined;

                let headerClasses =
                  "sticky left-10 z-20 bg-zinc-900 p-2 border border-zinc-800 text-left";
                const borderClass = "border-white/60";

                if (rowIsSingleBatch) {
                  // Check Top
                  const prevSpeed = speedValues[speedIndex - 1];
                  if (
                    !prevSpeed ||
                    batchLookup[`${accelValues[0]}-${prevSpeed}`] !==
                      firstAccelBatch
                  ) {
                    headerClasses += ` border-t-2 ${borderClass}`;
                  }
                  // Check Bottom
                  const nextSpeed = speedValues[speedIndex + 1];
                  if (
                    !nextSpeed ||
                    batchLookup[`${accelValues[0]}-${nextSpeed}`] !==
                      firstAccelBatch
                  ) {
                    headerClasses += ` border-b-2 ${borderClass}`;
                  }
                  // Check Left (Always border left of header if it's part of a batch)
                  headerClasses += ` border-l-2 ${borderClass}`;
                }

                // Find the group this row belongs to
                const group = rowGroups.find(
                  (g) =>
                    speedIndex >= g.startIndex &&
                    speedIndex < g.startIndex + g.count
                );
                const isFirstInGroup = group && group.startIndex === speedIndex;

                return (
                  <tr key={`${speed}-${speedIndex}`}>
                    {/* Batch Column */}
                    {isFirstInGroup && (
                      <th
                        className={`sticky left-0 z-30 bg-zinc-900 p-1 border border-zinc-800 text-center align-middle border-r-2 ${borderClass} border-t-2 border-b-2`}
                        rowSpan={group.count}
                      >
                        <div className="text-xs font-bold text-zinc-400 whitespace-normal leading-tight">
                          {group.batchIds ? group.batchIds.split(", ").join(", ") : "-"}
                        </div>
                      </th>
                    )}

                    <th className={headerClasses}>
                      <div className="text-xs font-bold text-emerald-400">
                        {flow.toFixed(2)}{" "}
                        <span className="text-[10px] font-normal text-zinc-500">
                          mm³/s
                        </span>
                      </div>
                      <div className="text-[10px] text-zinc-400 font-mono">
                        Speed: {speed}
                      </div>
                    </th>
                    {accelValues.map((accel, accelIndex) => {
                      const key = `${accel}-${speed}`;
                      const cell = state.grid[key] || {
                        accel,
                        speed,
                        paValues: [""],
                      };

                      return (
                        <td
                          key={key}
                          className="p-2 border border-zinc-800 bg-zinc-900/30 hover:bg-zinc-800/50 transition-colors align-top"
                        >
                          <div className="space-y-2">
                            {cell.paValues.map((pa, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-2"
                              >
                                <label className="text-[10px] text-zinc-500 w-6">
                                  PA{idx + 1}:
                                </label>
                                <input
                                  type="number"
                                  step="0.001"
                                  placeholder="0.000"
                                  value={pa}
                                  onChange={(e) =>
                                    handlePaChange(
                                      accel,
                                      speed,
                                      idx,
                                      e.target.value
                                    )
                                  }
                                  className={`flex-1 min-w-0 border border-zinc-700 rounded px-2 py-1 text-xs font-mono focus:border-blue-500 outline-none ${
                                    BG_COLORS[idx] || "bg-zinc-950"
                                  }`}
                                  autoComplete="off"
                                  name={`pa-${accel}-${speed}-${idx}-${resetKey}`}
                                />
                                {idx > 0 && (
                                  <button
                                    onClick={() =>
                                      removePaValue(accel, speed, idx)
                                    }
                                    className="text-zinc-600 hover:text-red-400 shrink-0"
                                  >
                                    <svg
                                      className="w-3 h-3"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      stroke="currentColor"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M6 18L18 6M6 6l12 12"
                                      />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            ))}

                            {cell.paValues.length < 3 && (
                              <button
                                onClick={() => addPaValue(accel, speed)}
                                className="w-full py-1 border border-dashed border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 rounded text-[10px] transition-colors flex items-center justify-center gap-1"
                              >
                                <svg
                                  className="w-3 h-3"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 4v16m8-8H4"
                                  />
                                </svg>
                                Add
                              </button>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
