import {
  IHubster,
  IConfigurer,
  IConfiguration,
  IRenderer,
  RendererRenderArguments,
  RendererDestroyArguments,
  TYPES,
  OnEventFunction,
  ITransactor
} from './types'
import { lazyInject } from './entities/inversify.config'
import { has } from './utils/has'

export class Hubster<AppId extends string> implements IHubster<AppId> {
  @lazyInject(TYPES.IRenderer)
  private renderer: IRenderer<AppId>
  @lazyInject(TYPES.IConfigurer)
  private configurer: IConfigurer
  @lazyInject(TYPES.ITransactor)
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
    this.renderer.render(args)
  }
  public destroy(args: RendererDestroyArguments<AppId>) {
    this.renderer.destroy(args)
  }
}
