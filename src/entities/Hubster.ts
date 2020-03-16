import {
  IHubster,
  IConfigurer,
  IConfiguration,
  IRenderer,
  RendererRenderArguments,
  RendererDestroyArguments,
  OnEventFunction,
  ITransactor
} from '../utils/types'
import { lazyInject } from '../config/inversify.config'
import { has } from '../utils/helpers'
import { EHubsterEvents, ETypes } from '../utils/enums'

export class Hubster<AppId extends string> implements IHubster<AppId> {
  @lazyInject(ETypes.RENDERER)
  private renderer: IRenderer<AppId>
  @lazyInject(ETypes.CONFIGURER)
  private configurer: IConfigurer
  @lazyInject(ETypes.TRANSACTOR)
  private transactor: ITransactor
  public static on: OnEventFunction = function on(action, id, callback): void {
    if (!has(Hubster.on, id)) {
      throw new Error(
        `Please provide the right id - no app named ${id} has been provided`
      )
    }
    Hubster.on[id][action] = callback
  }
  constructor(config: IConfiguration<AppId>) {
    this.configurer.setConfiguration(config)
    this.renderer.init(this.configurer, this.transactor)
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
