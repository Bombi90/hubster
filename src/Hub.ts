import {
  IHub,
  IConfigurer,
  IConfiguration,
  IRenderer,
  RendererRenderArguments,
  RendererDestroyArguments,
  ITransactor
} from './types'
import { lazyInject } from './entities/inversify.config'

import { EHubEvents, ETypes } from './enums'
import { Hubster } from './Hubster'

export class Hub<AppId extends string> implements IHub<AppId> {
  @lazyInject(ETypes.RENDERER)
  private renderer: IRenderer<AppId>
  @lazyInject(ETypes.CONFIGURER)
  private configurer: IConfigurer
  @lazyInject(ETypes.TRANSACTOR)
  private transactor: ITransactor
  constructor(config: IConfiguration<AppId>) {
    this.configurer.setConfiguration(config)
    this.renderer.init(this.configurer, this.transactor)
    Hubster.__publisher.listen()
  }
  public bind(appIds: AppId[]): Hub<AppId> {
    this.renderer.create(appIds)
    return this
  }
  public render(args: RendererRenderArguments<AppId>) {
    this.renderer.trigger<EHubEvents.RENDER>(EHubEvents.RENDER, args)
  }
  public destroy(args: RendererDestroyArguments<AppId>) {
    this.renderer.trigger<EHubEvents.DESTROY>(EHubEvents.DESTROY, args)
  }
}
