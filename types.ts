export interface DataPoint {
  pa: number;   // Pressure Advance (Z)
  fr: number;   // Flow Rate (X)
  acc: number;  // Acceleration (Y)
  lineIndex: number;
}

export enum InterpolationMethod {
  IDW = 'idw',
  RBF = 'rbf',
  PCHIP = 'pchip'
}

export enum RBFBasis {
  GAUSSIAN = 'gaussian',
  MULTIQUADRIC = 'multiquadric',
  INVERSE_MULTIQUADRIC = 'inverse_multiquadric',
  THIN_PLATE = 'thin_plate',
  LINEAR = 'linear'
}

export enum ScaleMode {
  RANGE = 'range',
  STD = 'std',
  MANUAL = 'manual'
}

export interface Dataset {
  id: number;
  name: string;
  text: string;
  points: DataPoint[];
  errors: string[];
  visible: boolean;
  color: string;
  pointColor: string;
}

export interface AppState {
  datasets: Dataset[];
  activeDatasetId: number;
  selectedPoint: { datasetId: number; lineIndex: number } | null;
}

export interface InterpolationConfig {
  method: InterpolationMethod;
  rbfBasis: RBFBasis;
  epsilon: number;
  lambda: number;
  power: number;
  gridResolution: number;
  scaleMode: ScaleMode;
  scaleX: number;
  scaleY: number;
  zMin: number;
  zMax: number;
  opacity: number;
  showContours: boolean;
}

// Extending Window for Plotly CDN
declare global {
  interface Window {
    Plotly: any;
  }
}

export interface CollectionConfig {
  accelMin: number;
  accelMax: number;
  accelSteps: number;
  speedMin: number;
  speedMax: number;
  speedSteps: number;
  nozzleSize: number;
  layerHeight: number;
  lineWidth: number;
  extrusionMultiplier: number;
  maxPatterns: number;
}

export interface CollectionCell {
  accel: number;
  speed: number;
  paValues: (number | string)[]; // Allow string for empty inputs
}

export interface CollectionState {
  config: CollectionConfig;
  grid: Record<string, CollectionCell>; // Key: "accel-speed"
}