import { injectable } from 'inversify'
import 'reflect-metadata'
import {
  IConfigurer,
  IGlobalDependency,
  IAppSelector,
  IApp,
  IConfiguration,
  AnyAppId
} from '../../types'

@injectable()
export class Jsonify implements IConfigurer {
  private configuration: IConfiguration<AnyAppId>
  public setConfiguration(config: IConfiguration<AnyAppId>): void {
    this.configuration = config
  }
  private findInApps<T extends keyof IApp<AnyAppId>>(
    id,
    el: T
  ): IApp<AnyAppId>[T] {
    const appConfig = this.configuration.apps.find(app => {
      return app.id === id
    })
    if (appConfig) {
      return appConfig[el]
    }
    throw new Error('Please provide a correct app name')
  }
  public getAppDefaultSelector(appId: string): IAppSelector {
    const elementFromConfig = this.findInApps(appId, 'el')
    if (elementFromConfig) {
      return elementFromConfig
    } else {
      const id = `${appId}_container`
      return {
        sel: `#${id}`,
        attrs: [{ type: 'id', value: id }],
        type: 'div'
      }
    }
  }
  public getAppUrl(appId: string): string {
    return this.findInApps(appId, 'url')
  }
  public getAppDependencies(appId: string): IGlobalDependency[] {
    const appDependencies = this.findInApps(appId, 'global_dependencies')
    return appDependencies
      .map(dependency => {
        return this.configuration.global_dependencies.find(
          ({ id: dependencyId }) => dependencyId === dependency
        )
      })
      .filter(Boolean)
  }
}
