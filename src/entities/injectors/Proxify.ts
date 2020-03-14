import {
  IInjector,
  IFetcher,
  IRendererCache,
  IGlobalDependency,
  Thenable,
  IInjectorResource,
  ISortedDependencies,
  ITemporaryDependencies,
  ITransactor,
  Transaction
} from '../../types'
import { injectable, inject } from 'inversify'
import { injectHead } from '../../utils/injectHead'
import { ETypes, ERendererStates } from '../../enums'

@injectable()
export class Proxify implements IInjector {
  @inject(ETypes.FETCHER) fetcher: IFetcher
  transactor: ITransactor
  public setTransactor(t: ITransactor): void {
    this.transactor = t
  }
  private sortResources(resources: IInjectorResource[]): IInjectorResource[] {
    return resources.sort((a, b) => {
      if (a.position < b.position) {
        return -1
      }
      if (a.position > b.position) {
        return 1
      }
      return 0
    })
  }
  private sortDependencies(
    appIds: string[],
    cache: IRendererCache
  ): ISortedDependencies {
    let dependencies: ITemporaryDependencies = {
      global: {},
      apps: {}
    }
    appIds.forEach(id => {
      const { dependencies: appDependencies, url } = cache.get(id)
      appDependencies.forEach(dependency => {
        if (dependencies.global[dependency.id]) return
        dependencies.global[dependency.id] = dependency
      })
      dependencies.apps[id] = url
    })
    const globalDependencies = this.checkWindowObject(dependencies.global)
    return {
      globalDependencies,
      appDependencies: dependencies.apps
    }
  }
  public fetchDependencies(appIds: string[], cache: IRendererCache): void {
    const idsNotYetFetched = appIds.filter(
      id => cache.get(id).state === ERendererStates.IDLE
    )
    const { globalDependencies, appDependencies } = this.sortDependencies(
      idsNotYetFetched,
      cache
    )
    const transaction = this.prepareTransaction(
      {
        globalDependencies,
        appDependencies
      },
      cache
    )

    this.transactor.setTransaction(transaction)
  }
  private checkWindowObject(deps: {
    [key: string]: IGlobalDependency
  }): string[] {
    return Object.values(deps).reduce((accumulator: string[], dependency) => {
      if (typeof window[dependency.global_object] !== 'object') {
        accumulator = [...accumulator, dependency.url]
      }
      return accumulator
    }, [])
  }
  private prepareTransaction(
    { globalDependencies, appDependencies }: ISortedDependencies,
    cache: IRendererCache
  ): Transaction {
    return async () => {
      let deferreds: Promise<{ [key: string]: any }>[] = []
      let resources: IInjectorResource[] = []
      let thenables: Thenable[] = []

      Object.entries(appDependencies).forEach(([id, url]) => {
        cache.set(id, {
          ...cache.get(id),
          state: ERendererStates.FETCHING
        })
        deferreds = deferreds.concat(
          this.fetcher.getText(url).then(text => {
            resources = resources.concat({
              text,
              position: Infinity,
              appId: id
            })
            return { url, index: Infinity }
          })
        )
      })

      globalDependencies.forEach((url, index) => {
        deferreds.push(
          this.fetcher.getText(url).then(text => {
            resources.push({
              text,
              position: index,
              appId: undefined
            })
            return { url, index }
          })
        )
      })
      await Promise.all(deferreds)
      this.sortResources(resources).forEach(resource => {
        thenables.push({
          then: (resolve: (args: IInjectorResource) => any) => {
            injectHead<IInjectorResource>(document, 'script', resource, resolve)
          }
        })
      })

      thenables.map(({ then }) =>
        then((resolve: IInjectorResource) => {
          if (resolve.appId) {
            cache.set(resolve.appId, {
              ...cache.get(resolve.appId),
              state: ERendererStates.FETCHED
            })
          }
        })
      )
    }
  }
}
