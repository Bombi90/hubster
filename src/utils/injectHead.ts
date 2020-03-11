import { ResourceType } from '../types'

export function injectHead<T extends { ['text']: string }>(
  doc: Document,
  type: ResourceType,
  resource: T,
  resolve: (...args: any) => any
) {
  const element = doc.createElement(type)
  element.appendChild(doc.createTextNode(resource.text))
  element.onload = resolve(resource)
  doc.head.appendChild(element)
}
