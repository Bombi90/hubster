import { Hubster } from './Hubster'
import { IHubster, IConfiguration } from './types'

export function createHub<AppId extends string>(
  config: IConfiguration<AppId>
): IHubster<AppId> {
  return new Hubster<AppId>(config)
}

declare global {
  interface Window {
    Hubster: {
      createHub: typeof createHub
    }
  }
}

window.Hubster = {
  createHub
}
