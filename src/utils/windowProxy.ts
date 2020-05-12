export function windowProxy<T extends object>(object: T, key: string): T {
  if (window[key]) {
    return window[key]
  }
  return object
}
