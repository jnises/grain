// Efficient array utilities to avoid spread operator performance issues
export function arrayMax(array) {
  if (array.length === 0) return -Infinity;
  let max = array[0];
  for (let i = 1; i < array.length; i++) {
    if (array[i] > max) max = array[i];
  }
  return max;
}

export function arrayMin(array) {
  if (array.length === 0) return Infinity;
  let min = array[0];
  for (let i = 1; i < array.length; i++) {
    if (array[i] < min) min = array[i];
  }
  return min;
}

export function arrayMinMax(array) {
  if (array.length === 0) return { min: Infinity, max: -Infinity };
  let min = array[0];
  let max = array[0];
  for (let i = 1; i < array.length; i++) {
    const value = array[i];
    if (value < min) min = value;
    else if (value > max) max = value;
  }
  return { min, max };
}
