import { IHub, IHubster, IConfiguration } from './types'
import { Hub } from './Hub'
import { EHubEvents } from './enums'
import { isString } from './utils/isString'
import { has } from './utils/has'
import { windowProxy } from './utils/windowProxy'
import { Publishify } from './entities/Publishify'

const ProtectedHubster: IHubster = {
  on(action, callback) {
    const [event, id] = action.split(':')
    if (EHubEvents[event.toUpperCase()]) {
      if (isString(id) && id.length) {
        if (!has(Hubster.on, id)) {
          throw new Error(
            `Please provide the right id - no app named ${id} has been provided`
          )
        }
        Hubster.on[id][event] = callback
      } else {
        throw new Error(`Please provide an id to the ${event} method`)
      }
    } else {
      return Hubster.__publisher.register(action, callback)
    }
    return void 0
  },
  dispatch(actionName: string, payload: any) {
    if (isString(actionName) && actionName.length) {
      Hubster.__publisher.dispatch(actionName, payload)
    }
  },
  createHub<AppId extends string>(config: IConfiguration<AppId>): IHub<AppId> {
    return new Hub<AppId>(config)
  },
  __publisher: Publishify
}

export const Hubster = windowProxy(ProtectedHubster, 'Hubster')
