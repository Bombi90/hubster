import {
  IHubster,
  IConfigurer,
  IConfiguration,
  IRenderer,
  RendererRenderArguments,
  RendererDestroyArguments,
  OnEventFunction,
  ITransactor,
  Callback
} from './types'
import { lazyInject } from './entities/inversify.config'
import { has } from './utils/has'
import { EHubsterEvents, ETypes } from './enums'
import { isString } from './utils/isString'
import { Publishify } from './entities/Publishify'

export class Hubster<AppId extends string> implements IHubster<AppId> {
  @lazyInject(ETypes.RENDERER)
  private renderer: IRenderer<AppId>
  @lazyInject(ETypes.CONFIGURER)
  private configurer: IConfigurer
  @lazyInject(ETypes.TRANSACTOR)
  private transactor: ITransactor
  public static on: OnEventFunction = function on(
    action,
    callback
  ): void | Callback {
    const [event, id] = action.split(':')
    if (EHubsterEvents[event.toUpperCase()]) {
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
      return Publishify.register(action, callback)
    }
  }
  public static dispatch(actionName: string, payload: any) {
    if (isString(actionName) && actionName.length) {
      Publishify.dispatch(actionName, payload)
    }
  }
  constructor(config: IConfiguration<AppId>) {
    this.configurer.setConfiguration(config)
    this.renderer.init(this.configurer, this.transactor)
    Publishify.listen()
  }
  public bind(appIds: AppId[]): Hubster<AppId> {
    this.renderer.create(appIds)
    return this
  }
  public render(args: RendererRenderArguments<AppId>) {
    this.renderer.trigger<EHubsterEvents.RENDER>(EHubsterEvents.RENDER, args)
  }
  public destroy(args: RendererDestroyArguments<AppId>) {
    this.renderer.trigger<EHubsterEvents.DESTROY>(EHubsterEvents.DESTROY, args)
  }
}
