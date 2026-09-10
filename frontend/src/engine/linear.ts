/** Diagonal equilibration and partial pivoting for the grounded graph Laplacian. */
export function solveLinear(matrix: Float64Array, rhs: Float64Array): Float64Array | null {
  const size = rhs.length
  const scale = new Float64Array(size)
  const a = matrix.slice()
  const b = rhs.slice()
  for (let i = 0; i < size; i++) {
    if (!(a[i * size + i] > 0) || !Number.isFinite(a[i * size + i])) return null
    scale[i] = Math.sqrt(a[i * size + i])
  }
  for (let i = 0; i < size; i++) {
    b[i] /= scale[i]
    for (let j = 0; j < size; j++) a[i * size + j] /= scale[i] * scale[j]
  }
  for (let k = 0; k < size; k++) {
    let pivot = k
    for (let i = k + 1; i < size; i++) if (Math.abs(a[i * size + k]) > Math.abs(a[pivot * size + k])) pivot = i
    if (!Number.isFinite(a[pivot * size + k]) || Math.abs(a[pivot * size + k]) < 1e-16) return null
    if (pivot !== k) {
      for (let j = k; j < size; j++) {
        const temp = a[k * size + j]; a[k * size + j] = a[pivot * size + j]; a[pivot * size + j] = temp
      }
      const temp = b[k]; b[k] = b[pivot]; b[pivot] = temp
    }
    for (let i = k + 1; i < size; i++) {
      const factor = a[i * size + k] / a[k * size + k]
      a[i * size + k] = 0
      for (let j = k + 1; j < size; j++) a[i * size + j] -= factor * a[k * size + j]
      b[i] -= factor * b[k]
    }
  }
  const solution = new Float64Array(size)
  for (let i = size - 1; i >= 0; i--) {
    let value = b[i]
    for (let j = i + 1; j < size; j++) value -= a[i * size + j] * solution[j]
    solution[i] = value / a[i * size + i]
  }
  for (let i = 0; i < size; i++) {
    solution[i] /= scale[i]
    if (!Number.isFinite(solution[i])) return null
  }
  return solution
}
