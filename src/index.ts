import { Hubster } from './Hubster'
import { IHubster, IConfiguration } from './types'

export function createHub<AppId extends string>(
  config: IConfiguration<AppId>
): IHubster<AppId> {
  return new Hubster<AppId>(config)
}

const getter = Object.freeze({
  createHub,
  on: Hubster.on,
  dispatch: Hubster.dispatch
})

const descriptor: PropertyDescriptor = {
  enumerable: false,
  configurable: false,
  get() {
    return getter
  },
  set() {
    return
  }
}
const isHubsterLoaded = 'Hubster' in window
if (!isHubsterLoaded) {
  Object.defineProperty(window, 'Hubster', descriptor)
}
