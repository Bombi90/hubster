import { Hubster } from './Hubster'

const descriptor: PropertyDescriptor = {
  enumerable: false,
  configurable: false,
  get() {
    return Hubster
  },
  set() {
    return
  }
}
const isHubsterLoaded = 'Hubster' in window
if (!isHubsterLoaded) {
  Object.defineProperty(window, 'Hubster', descriptor)
}
