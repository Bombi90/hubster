export function defaultFromPath<T>(
  defaultValue: T,
  pathsArray: string[],
  obj: { [key: string]: any }
): T {
  let val = defaultValue
  pathsArray.forEach(path => {
    if (val == null) {
      val = defaultValue
      return
    }
    val = obj[path]
  })
  return val
}
