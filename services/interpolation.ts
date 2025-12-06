import { DataPoint, InterpolationMethod, RBFBasis } from '../types';

// --- Math Helpers ---

function phi(r: number, basis: RBFBasis, epsilon: number): number {
  const e = epsilon;
  switch (basis) {
    case RBFBasis.GAUSSIAN: return Math.exp(-Math.pow(e * r, 2));
    case RBFBasis.MULTIQUADRIC: return Math.sqrt(1 + Math.pow(e * r, 2));
    case RBFBasis.INVERSE_MULTIQUADRIC: return 1 / Math.sqrt(1 + Math.pow(e * r, 2));
    case RBFBasis.THIN_PLATE: return r < 1e-12 ? 0 : (r * r * Math.log(r));
    case RBFBasis.LINEAR: return r;
    default: return r;
  }
}

function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = A.length;
  // Augment matrix
  const aug = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let pivot = col;
    let maxVal = Math.abs(aug[col][col]);

    for (let r = col + 1; r < n; r++) {
      const val = Math.abs(aug[r][col]);
      if (val > maxVal) {
        maxVal = val;
        pivot = r;
      }
    }

    if (maxVal < 1e-18) {
       // Fallback or simplified handling for singular matrices could go here
       // For now, we return 0 vector if singular to avoid crash
       return new Array(n).fill(0); 
    }

    // Swap rows
    [aug[col], aug[pivot]] = [aug[pivot], aug[col]];

    // Normalize pivot row
    for (let r = col + 1; r < n; r++) {
      const factor = aug[r][col] / aug[col][col];
      for (let c = col; c <= n; c++) {
        aug[r][c] -= factor * aug[col][c];
      }
    }
  }

  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let sum = aug[r][n];
    for (let c = r + 1; c < n; c++) {
      sum -= aug[r][c] * x[c];
    }
    x[r] = sum / aug[r][r];
  }
  return x;
}

// --- PCHIP Implementation ---

class PchipInterpolator {
  x_: number[];
  y_: number[];
  h_: number[];
  delta_: number[];
  d_: number[];

  constructor(x: number[], y: number[]) {
    const data = x.map((val, i) => ({ x: val, y: y[i] })).sort((a, b) => a.x - b.x);
    this.x_ = data.map(d => d.x);
    this.y_ = data.map(d => d.y);
    
    const n = this.x_.length - 1;
    this.h_ = new Array(n);
    this.delta_ = new Array(n);
    this.d_ = new Array(n + 1);

    if(n < 1) {
        // Handle insufficient data gracefully
        this.d_.fill(0);
        return;
    }

    for (let i = 0; i < n; ++i) {
      this.h_[i] = this.x_[i + 1] - this.x_[i];
      this.delta_[i] = (this.y_[i + 1] - this.y_[i]) / this.h_[i];
    }

    this.d_[0] = this.delta_[0];
    this.d_[n] = this.delta_[n - 1];

    for (let i = 1; i < n; ++i) {
      if (this.delta_[i - 1] * this.delta_[i] > 0) {
        const w1 = 2 * this.h_[i] + this.h_[i - 1];
        const w2 = this.h_[i] + 2 * this.h_[i - 1];
        this.d_[i] = (w1 + w2) / (w1 / this.delta_[i - 1] + w2 / this.delta_[i]);
      } else {
        this.d_[i] = 0;
      }
    }
  }

  interpolate(xi: number): number {
    if (this.x_.length < 2) return this.y_[0] || 0;
    if (xi <= this.x_[0]) return this.y_[0];
    if (xi >= this.x_[this.x_.length - 1]) return this.y_[this.y_.length - 1];

    let i = 0;
    while (i < this.x_.length - 2 && xi > this.x_[i + 1]) {
      i++;
    }

    const h_i = this.h_[i];
    const t = (xi - this.x_[i]) / h_i;
    const t2 = t * t;
    const t3 = t2 * t;

    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;

    return h00 * this.y_[i] + h10 * h_i * this.d_[i] + h01 * this.y_[i + 1] + h11 * h_i * this.d_[i + 1];
  }
}

// --- Main Evaluation Function ---

// --- Main Evaluation Function ---

export function createInterpolator(
  points: DataPoint[],
  method: InterpolationMethod,
  options: {
    basis: RBFBasis;
    epsilon: number;
    lambda: number;
    power: number;
    scaleX: number;
    scaleY: number;
  }
): (x: number, y: number) => number {
  if (points.length === 0) return () => 0;

  // Pre-compute RBF weights if needed
  let rbfWeights: number[] = [];
  let polyWeights: number[] = []; // [c0, c1, c2] for c0 + c1*x + c2*y

  if (method === InterpolationMethod.RBF) {
    const n = points.length;
    // Augmented matrix size: (n + 3) x (n + 3) for linear polynomial term
    const size = n + 3;
    const A = Array.from({ length: size }, () => new Array(size).fill(0));

    // Fill top-left n x n block with RBF kernel + lambda
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const dx = (points[i].fr - points[j].fr) / options.scaleX;
        const dy = (points[i].acc - points[j].acc) / options.scaleY;
        const r = Math.hypot(dx, dy);
        A[i][j] = phi(r, options.basis, options.epsilon);
      }
      A[i][i] += options.lambda;
    }

    // Fill P matrix (n x 3) and P^T (3 x n)
    // P columns: [1, x, y]
    for (let i = 0; i < n; i++) {
      const x = points[i].fr / options.scaleX;
      const y = points[i].acc / options.scaleY;
      
      // P block (top-right)
      A[i][n] = 1;
      A[i][n + 1] = x;
      A[i][n + 2] = y;

      // P^T block (bottom-left)
      A[n][i] = 1;
      A[n + 1][i] = x;
      A[n + 2][i] = y;
    }

    // Bottom-right 3x3 block is zeros (already filled)

    // Construct RHS vector b
    const b = new Array(size).fill(0);
    for (let i = 0; i < n; i++) {
      b[i] = points[i].pa;
    }
    // Last 3 elements of b are 0 (constraints)

    const weights = solveLinearSystem(A, b);
    rbfWeights = weights.slice(0, n);
    polyWeights = weights.slice(n, n + 3);
  }

  // Pre-compute PCHIP Interpolators if needed
  const flowInterpolators = new Map<number, PchipInterpolator>();
  let sortedAccels: number[] = [];
  
  if (method === InterpolationMethod.PCHIP) {
     sortedAccels = [...new Set(points.map(p => p.acc))].sort((a, b) => a - b);
     for (const accel of sortedAccels) {
       const pts = points.filter(p => p.acc === accel).sort((a, b) => a.fr - b.fr);
       if (pts.length >= 2) {
         flowInterpolators.set(accel, new PchipInterpolator(pts.map(p=>p.fr), pts.map(p=>p.pa)));
       }
     }
  }

  return (x: number, y: number) => {
      let z = 0;
      if (method === InterpolationMethod.RBF) {
         const sx = x / options.scaleX;
         const sy = y / options.scaleY;

         // RBF Sum
         for (let k = 0; k < points.length; k++) {
           const r = Math.hypot((x - points[k].fr) / options.scaleX, (y - points[k].acc) / options.scaleY);
           z += rbfWeights[k] * phi(r, options.basis, options.epsilon);
         }
         
         // Polynomial Sum: c0 + c1*x + c2*y
         if (polyWeights.length === 3) {
             z += polyWeights[0] + polyWeights[1] * sx + polyWeights[2] * sy;
         }

      } else if (method === InterpolationMethod.PCHIP) {
         if (flowInterpolators.size === 0) {
             z = 0;
         } else {
            // Bilinear-ish approach with PCHIP along flow lines
            if (y <= sortedAccels[0]) {
                z = flowInterpolators.get(sortedAccels[0])?.interpolate(x) ?? 0;
            } else if (y >= sortedAccels[sortedAccels.length - 1]) {
                z = flowInterpolators.get(sortedAccels[sortedAccels.length - 1])?.interpolate(x) ?? 0;
            } else {
                let idx = 0;
                while (idx < sortedAccels.length - 2 && y > sortedAccels[idx + 1]) idx++;
                const a1 = sortedAccels[idx];
                const a2 = sortedAccels[idx + 1];
                const pa1 = flowInterpolators.get(a1)?.interpolate(x) ?? 0;
                const pa2 = flowInterpolators.get(a2)?.interpolate(x) ?? 0;
                z = pa1 + (pa2 - pa1) * (y - a1) / (a2 - a1);
            }
         }
      } else {
        // IDW
        let num = 0, den = 0;
        let minDist = Infinity;
        let minVal = points[0]?.pa ?? 0;

        for (const p of points) {
          const dx = (x - p.fr) / options.scaleX;
          const dy = (y - p.acc) / options.scaleY;
          const d2 = dx*dx + dy*dy;
          if (d2 < 1e-12) {
            z = p.pa;
            minDist = 0;
            break;
          }
          const d = Math.sqrt(d2);
          if (d < minDist) { minDist = d; minVal = p.pa; }
          const w = 1 / Math.pow(d, options.power);
          num += w * p.pa;
          den += w;
        }
        if (minDist > 1e-6) {
            z = num / den;
        }
      }
      return z;
  };
}

export function generateSurface(
  points: DataPoint[],
  method: InterpolationMethod,
  gridSize: number,
  options: {
    basis: RBFBasis;
    epsilon: number;
    lambda: number;
    power: number;
    scaleX: number;
    scaleY: number;
  }
) {
  if (points.length === 0) return { xi: [], yi: [], zi: [] };

  const xVals = points.map(p => p.fr);
  const yVals = points.map(p => p.acc);
  const xMin = Math.min(...xVals);
  const xMax = Math.max(...xVals);
  const yMin = Math.min(...yVals);
  const yMax = Math.max(...yVals);

  // Create Grid
  const xi = Array.from({ length: gridSize }, (_, i) => xMin + (xMax - xMin) * i / (gridSize - 1));
  const yi = Array.from({ length: gridSize }, (_, j) => yMin + (yMax - yMin) * j / (gridSize - 1));
  
  const interpolate = createInterpolator(points, method, options);
  const zi: number[][] = [];

  // Evaluate Grid
  for (let j = 0; j < gridSize; j++) {
    const row: number[] = [];
    for (let i = 0; i < gridSize; i++) {
      row.push(interpolate(xi[i], yi[j]));
    }
    zi.push(row);
  }

  return { xi, yi, zi };
}