import { CollectionCell, CollectionState } from '../types';

export const generateSteps = (min: number, max: number, steps: number, precision: number = 2) => {
  if (steps <= 1) return [min];
  const stepSize = (max - min) / (steps - 1);
  return Array.from({ length: steps }, (_, i) => {
    const val = min + i * stepSize;
    const factor = Math.pow(10, precision);
    return Math.round(val * factor) / factor;
  });
};

export const generateGrid = (config: CollectionState['config']): Record<string, CollectionCell> => {
    const accelValues = generateSteps(config.accelMin, config.accelMax, config.accelSteps, 0);
    const speedValues = generateSteps(config.speedMin, config.speedMax, config.speedSteps, 2);
    
    const newGrid: Record<string, CollectionCell> = {};
    
    accelValues.forEach(accel => {
      speedValues.forEach(speed => {
        const key = `${accel}-${speed}`;
        newGrid[key] = { accel, speed, paValues: [''] };
      });
    });
    
    return newGrid;
};
