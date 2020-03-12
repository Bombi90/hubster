import {
  IInjector,
  TYPES,
  IFetcher,
  InjectorState,
  IRendererCache,
  IGlobalDependency,
  Thenable,
  IInjectorResource,
  ISortedDependencies,
  ITemporaryDependencies
} from '../../types'
import { injectable, inject } from 'inversify'
import { injectHead } from '../../utils/injectHead'

@injectable()
export class Proxify implements IInjector {
  @inject(TYPES.IFetcher) fetcher: IFetcher
  private state: InjectorState = new Map()
  private transaction: number | boolean = false
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
      console.log(cache, id)
      console.log(cache.get(id))
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
    const { globalDependencies, appDependencies } = this.sortDependencies(
      appIds,
      cache
    )
    const transactionId = new Date().valueOf()
    const transactionValue = this.prepareTransaction(
      {
        globalDependencies,
        appDependencies
      },
      cache
    )

    this.state.set(transactionId, transactionValue)
    if (!this.transaction) {
      this.transaction = transactionId
      this.commit(transactionId)
    }
  }
  private async commit(transactionId: number) {
    const transaction = this.state.get(transactionId)
    await transaction()
    this.transaction = false
    this.state.delete(transactionId)
    const next = this.state.entries().next().value
    if (next) {
      this.commit(next)
    }
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
  ): () => Promise<any> {
    return async () => {
      let deferreds: Promise<{ [key: string]: any }>[] = []
      let resources: IInjectorResource[] = []
      let thenables: Thenable[] = []

      Object.entries(appDependencies).forEach(([id, url]) => {
        cache.set(id, {
          ...cache.get(id),
          state: 'fetching'
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
              state: 'fetched'
            })
          }
        })
      )
    }
  }
}
