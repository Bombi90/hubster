import {
  IHubster,
  IConfigurer,
  IConfiguration,
  IRenderer,
  RendererMountArguments,
  RendererUnmountArguments,
  TYPES
} from './types'
import { lazyInject } from './entities/inversify.config'

export class Hubster<AppId extends string> implements IHubster<AppId> {
  @lazyInject(TYPES.IRenderer)
  private renderer: IRenderer<AppId>
  @lazyInject(TYPES.IConfigurer)
  private configurer: IConfigurer
  constructor(config: IConfiguration<AppId>) {
    this.configurer.setConfiguration(config)
    this.renderer.setConfigurer(this.configurer)
  }
  public bind(appIds: AppId[]): Hubster<AppId> {
    this.renderer.create(appIds)
    return this
  }
  public render(args: RendererMountArguments<AppId>) {
    this.renderer.mount(args)
  }
  public destroy(args: RendererUnmountArguments<AppId>) {
    this.renderer.unmount(args)
  }
}
