import { injectable, inject } from 'inversify'
import 'reflect-metadata'
import {
  IRenderer,
  IConfigurer,
  RendererMountArguments,
  RendererUnmountArguments,
  IRendererCache,
  TYPES,
  IInjector,
  ProxyValues,
  IRenderMount,
  IRenderUnmount,
  IRendererCacheValues,
  IRepository,
  AnyAppId
} from '../../types'
import { createLoader } from '../../utils/createLoader'
import { has } from '../../utils/has'

@injectable()
export class Htmlify implements IRenderer<AnyAppId> {
  private configurer: IConfigurer
  private cache: IRendererCache = new Map()
  @inject(TYPES.IInjector) injector: IInjector
  setConfigurer(configurer: IConfigurer): void {
    this.configurer = configurer
  }
  private getCacheValue(id: string): IRendererCacheValues {
    if (this.cache.has(id)) {
      return this.cache.get(id)
    }
    throw new Error('wrong key ( id ) provided')
  }
  private setCacheValue(id: string, value: IRendererCacheValues): void {
    this.cache.set(id, value)
  }
  private setProxy(id: string) {
    const handler = {
      set: (obj, prop: ProxyValues, value: (...args: []) => {}) => {
        const cache = this.getCacheValue(id)
        if (prop === 'render') {
          cache.mount = value
        }
        if (prop === 'unmount') {
          cache.unmount = value
        }
        obj[prop] = value
        if (cache.mount && cache.unmount) {
          cache.subscribers.map(fn => {
            fn()
          })
          this.setCacheValue(id, {
            ...cache,
            subscribers: []
          })
        }
        return true
      }
    }

    if (!has(window, id)) window[id] = new Proxy({}, handler)
  }

  public create(appIds: string[]): void {
    appIds.forEach(id => {
      if (this.cache.has(id)) {
        return
      }
      const selector = this.configurer.getAppSelector(id)
      const dependencies = this.configurer.getAppDependencies(id)
      const url = this.configurer.getAppUrl(id)

      this.setProxy(id)

      this.setCacheValue(id, {
        selector,
        dependencies,
        url,
        subscribers: [],
        mount: undefined,
        unmount: undefined,
        state: 'idle'
      })
    })

    this.injector.fetchDependencies(appIds, this.cache)
    return
  }
  private checkForElementInCache(id: string): boolean {
    if (!this.cache.has(id)) {
      throw new Error(`Please provide correct app name: ${id} does not exists`)
    }
    return true
  }
  private createContainer(appIds: string[], loader): void {
    appIds.forEach(id => {
      const { type, attrs, sel } = this.getCacheValue(id).selector
      const element = document.querySelector(sel)
      let loaderHTML: HTMLElement
      if (loader[id]) {
        if (typeof loader === 'boolean') {
          loaderHTML = createLoader()
        } else {
          loaderHTML = loader
        }
      }
      if (!element) {
        const node = document.createElement(type)
        attrs.forEach(({ type: attributeType, value }) =>
          node.setAttribute(attributeType, value)
        )
        if (loaderHTML) {
          node.appendChild(loaderHTML)
        }
        document.body.appendChild(node)
        return
      }
      if (loaderHTML) {
        element.appendChild(loaderHTML)
      }
    })
  }
  private getRepositories(
    args: RendererMountArguments<AnyAppId> | RendererUnmountArguments<AnyAppId>
  ): IRepository {
    let props = {}
    let loader = {}
    let onMount = {}
    let onUnmount = {}

    if (!args) {
      let keys = []
      for (const key of this.cache.keys()) {
        keys.push(key)
      }
      return { ids: keys }
    } else if (typeof args === 'string') {
      if (this.checkForElementInCache(args)) {
        return { ids: [args] }
      }
    } else if (Array.isArray(args)) {
      const ids = (args as Array<
        (IRenderMount<AnyAppId> & IRenderUnmount<AnyAppId>) | string
      >).map(appToMount => {
        if (typeof appToMount === 'string') {
          if (this.checkForElementInCache(appToMount)) {
            return appToMount
          }
        } else if (has(appToMount, 'id')) {
          const {
            id,
            props: appProps,
            loader: appLoader,
            onDestroy,
            onRender
          } = appToMount
          if (this.checkForElementInCache(id)) {
            if (appProps) {
              props[id] = appProps
            }
            if (appLoader) {
              loader[id] = appLoader
            }
            if (onRender) {
              onMount[id] = onRender
            }
            if (onDestroy) {
              onUnmount[id] = onDestroy
            }
            return id
          }
        }
        throw new Error('Wrong Arguments supplied')
      })
      return { ids, props, loader, onMount, onUnmount }
    }
    throw new Error('Wrong Arguments supplied')
  }
  mount(args: RendererMountArguments<AnyAppId>): void {
    const {
      ids: appIds,
      onMount = {},
      loader = {},
      props = {}
    } = this.getRepositories(args)
    this.createContainer(appIds, loader)
    appIds.map(id => {
      const cache = this.getCacheValue(id)
      if (cache.state === 'fetched' || cache.state === 'destroyed') {
        if (typeof onMount[id] === 'function') {
          cache.mount({ props, cb: onMount[id] })
        } else {
          cache.mount(props)
        }

        this.setCacheValue(id, {
          ...cache,
          state: 'mounted',
          subscribers: []
        })
      } else if (cache.state !== 'mounted') {
        const self = this
        this.setCacheValue(id, {
          ...cache,
          subscribers: [
            ...cache.subscribers.filter(fn => fn.name !== 'mount'),
            function mount() {
              self.mount(args)
            }
          ],
          state: 'mounting'
        })
      }
    })
    return
  }
  unmount(args: RendererUnmountArguments<AnyAppId>): void {
    const { ids: appIds, onUnmount = {} } = this.getRepositories(args)
    appIds.map(id => {
      const cache = this.getCacheValue(id)
      if (cache.state === 'mounted') {
        if (typeof onUnmount[id] === 'function') {
          cache.unmount({ cb: onUnmount[id] })
        } else {
          cache.unmount()
        }
        this.setCacheValue(id, {
          ...cache,
          state: 'destroyed',
          subscribers: []
        })
      } else if (cache.state === 'mounting') {
        const self = this
        this.setCacheValue(id, {
          ...cache,
          subscribers: [
            ...cache.subscribers.filter(fn => fn.name !== 'unmount'),
            function unmount() {
              self.unmount(args)
            }
          ],
          state: 'destroying'
        })
      }
    })
    return
  }
}
