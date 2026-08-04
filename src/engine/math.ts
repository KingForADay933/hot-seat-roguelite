export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length
}
