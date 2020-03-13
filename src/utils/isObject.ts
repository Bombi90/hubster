export const isObject = (element: any): element is Record<string, any> =>
  typeof element === 'object' && !Array.isArray(element)
