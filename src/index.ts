import { Hubster } from './entities/Hubster'
import { IHubster, IConfiguration } from './utils/types'

export function createHub<AppId extends string>(
  config: IConfiguration<AppId>
): IHubster<AppId> {
  return new Hubster<AppId>(config)
}

window.Hubster = {
  createHub,
  on: Hubster.on,
  dispatch: Hubster.dispatch
}
