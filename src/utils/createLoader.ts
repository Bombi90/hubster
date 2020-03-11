export const createLoader = (): HTMLElement => {
  const element = document.createElement('div')
  element.innerHTML = 'Loading'
  return element
}
