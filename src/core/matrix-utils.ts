import { Matrix } from 'ml-matrix';

export function zeros(rows: number, cols: number): Matrix {
  return Matrix.zeros(rows, cols);
}

export function eye(n: number): Matrix {
  return Matrix.eye(n);
}

export function multiply(a: Matrix, b: Matrix): Matrix {
  return a.mmul(b);
}

/** Compute Tᵀ · K · T */
export function transformMatrix(T: Matrix, K: Matrix): Matrix {
  return T.transpose().mmul(K).mmul(T);
}

/** Extract a sub-matrix by row/col indices */
export function subMatrix(m: Matrix, rows: number[], cols: number[]): Matrix {
  return m.selection(rows, cols);
}

/** Add source sub-matrix into target at specified row/col indices */
export function addSubMatrix(
  target: Matrix,
  source: Matrix,
  rows: number[],
  cols: number[]
): void {
  for (let i = 0; i < rows.length; i++) {
    for (let j = 0; j < cols.length; j++) {
      target.set(rows[i], cols[j], target.get(rows[i], cols[j]) + source.get(i, j));
    }
  }
}

export function columnVector(data: number[]): Matrix {
  return Matrix.columnVector(data);
}

export function toArray(m: Matrix): number[] {
  const result: number[] = [];
  for (let i = 0; i < m.rows; i++) {
    result.push(m.get(i, 0));
  }
  return result;
}
