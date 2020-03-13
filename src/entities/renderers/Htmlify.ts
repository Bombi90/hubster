import { injectable, inject } from 'inversify'
import 'reflect-metadata'
import {
  IRenderer,
  IConfigurer,
  RendererRenderArguments,
  RendererDestroyArguments,
  IRendererCache,
  TYPES,
  IInjector,
  ProxyValues,
  IRenderRender,
  IRenderDestroy,
  IRendererCacheValues,
  IRepository,
  AnyAppId,
  IContainerCreator,
  ITransactor
} from '../../types'
import { createLoader } from '../../utils/createLoader'
import { has } from '../../utils/has'
import { Hubster } from '../../Hubster'

class Mutex<T> {
  private mutex = Promise.resolve()

  lock(): PromiseLike<() => void> {
    let begin: (unlock: () => void) => void = unlock => {
      console.log(unlock)
      return
    }

    this.mutex = this.mutex.then(() => {
      return new Promise(begin)
    })

    return new Promise(res => {
      begin = res
    })
  }

  async dispatch(fn: (() => T) | (() => PromiseLike<T>)): Promise<T> {
    const unlock = await this.lock()
    try {
      return await Promise.resolve(fn())
    } finally {
      unlock()
    }
  }
}

async function asyncForEach(array, callback) {
  for (let el of array) {
    await callback(el)
  }
}

const collectionMutex = new Mutex<void>()
@injectable()
export class Htmlify implements IRenderer<AnyAppId> {
  static allowedElementsForShadowRoot: string[] = [
    'article',
    'aside',
    'blockquote',
    'body',
    'div',
    'footer',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'header',
    'main',
    'nav',
    'p',
    'section',
    'span'
  ]
  private transactor: ITransactor
  private configurer: IConfigurer
  private cache: IRendererCache = new Map()
  @inject(TYPES.IInjector) injector: IInjector
  init(configurer: IConfigurer, transactor: ITransactor): void {
    this.configurer = configurer
    this.injector.setTransactor(transactor)
    this.transactor = transactor
    console.log(this.transactor)
  }
  private processes = {
    started: false,
    state: 'idle',
    queue: {},
    processed: []
  }
  private getCacheValue(id: string): IRendererCacheValues {
    if (this.cache.has(id)) {
      return this.cache.get(id)
    }
    throw new Error(`wrong key ( ${id} ) provided`)
  }
  private async setCacheValue(
    id: string,
    value: IRendererCacheValues
  ): Promise<void> {
    return await collectionMutex.dispatch(async () => {
      this.cache.set(id, value)
    })
  }
  private setProxy(id: string) {
    const handler = {
      set: (obj, prop: ProxyValues, value: (...args: []) => {}) => {
        if (prop === 'render') {
          const transaction = new Date().valueOf()

          this.processes.queue[transaction] = async () => {
            await this.setCacheValue(id, {
              ...this.getCacheValue(id),
              render: value
            })
            const cache = this.getCacheValue(id)
            if (cache.render && cache.destroy) {
              cache.subscribers.map(fn => {
                fn()
              })
            }
          }
          this.checkForProcesses()
        }
        if (prop === 'destroy') {
          const transaction = new Date().valueOf()
          this.processes.queue[transaction] = async () => {
            await this.setCacheValue(id, {
              ...this.getCacheValue(id),
              destroy: value
            })
            const cache = this.getCacheValue(id)
            if (cache.render && cache.destroy) {
              cache.subscribers.map(fn => {
                fn()
              })
            }
          }
          this.checkForProcesses()
        }
        obj[prop] = value
        return true
      }
    }

    if (!has(Hubster.on, id)) Hubster.on[id] = new Proxy({}, handler)
  }

  public create(appIds: string[]): void {
    const transaction = new Date().valueOf()
    this.processes.queue[transaction] = async () => {
      await asyncForEach(appIds, async id => {
        if (this.cache.has(id)) {
          return
        }
        const selector = this.configurer.getAppDefaultSelector(id)
        const dependencies = this.configurer.getAppDependencies(id)
        const url = this.configurer.getAppUrl(id)

        this.setProxy(id)

        await this.setCacheValue(id, {
          selector,
          dependencies,
          url,
          subscribers: [],
          render: undefined,
          destroy: undefined,
          state: 'idle',
          element: undefined,
          refs: {}
        })
        console.log(this.cache)
      })
      this.injector.fetchDependencies(appIds, this.cache)
    }
    this.checkForProcesses()
  }
  private checkForElementInCache(id: string): boolean {
    if (!this.cache.has(id)) {
      throw new Error(`Please provide correct app name: ${id} does not exists`)
    }
    return true
  }
  private async createContainer(args: IContainerCreator): Promise<void> {
    const { loader, id, element, ref } = args
    const cache = this.getCacheValue(id)
    const {
      selector: { type, attrs, sel },
      element: appElement,
      refs: cachedReferences
    } = cache

    if (!ref && cache.state === 'rendered') {
      return
    } else if (
      has(cachedReferences, ref) &&
      cachedReferences[ref].state === 'rendered'
    ) {
      return
    }

    let loaderHTML: HTMLElement
    if (loader) {
      if (typeof loader === 'boolean') {
        loaderHTML = createLoader()
      } else {
        loaderHTML = loader
      }
    }

    if (!ref) {
      let domNode: HTMLElement | undefined
      if (!element) {
        // in case no element has been provided with the render call

        if (appElement && document.contains(appElement)) {
          console.log('HERE 2')
          if (loaderHTML) {
            appElement.appendChild(loaderHTML)
          }
        } else if (document.querySelector(sel)) {
          console.log('HERE 1')
          domNode = document.querySelector(sel)
          if (loaderHTML) {
            domNode.appendChild(loaderHTML)
          }
        } else {
          console.log('HERE')
          domNode = document.createElement(type)
          attrs.forEach(({ type: attributeType, value }) =>
            domNode.setAttribute(attributeType, value)
          )
          if (loaderHTML) {
            domNode.appendChild(loaderHTML)
          }
          document.body.appendChild(domNode)
        }
      } else {
        console.log('HERE 4', element)
        if (typeof element === 'string') {
          domNode = document.querySelector(element)
          if (!domNode) {
            throw new Error(`Cannot find ${element} in the DOM`)
          }
        } else if (element instanceof HTMLElement) {
          domNode = element
        } else if (typeof element === 'object' && !Array.isArray(element)) {
          if ('selector' in element) {
            const { selector } = element
            domNode = document.querySelector(selector)
            if (!domNode) {
              throw new Error(`Cannot find ${selector} in the DOM`)
            }
          } else if ('node' in element) {
            const { node } = element
            domNode = node
          } else {
            throw new Error('Wrong Element provided')
          }
          if (element.shadow) {
            if (
              !Htmlify.allowedElementsForShadowRoot.includes(
                domNode.nodeName.toLowerCase()
              )
            ) {
              throw new Error(
                'The node you provided does not support Shadow Root'
              )
            }
            const shadowRoot =
              domNode.shadowRoot ||
              domNode.attachShadow({
                mode: 'open',
                delegatesFocus: false
              })
            const elementAlreadyInShadowRoot = shadowRoot.querySelector(sel)
            if (elementAlreadyInShadowRoot) {
              domNode = elementAlreadyInShadowRoot as HTMLElement
            } else {
              domNode = document.createElement(type)
              attrs.forEach(({ type: attributeType, value }) =>
                domNode.setAttribute(attributeType, value)
              )
              shadowRoot.appendChild(domNode)
            }
          }
        }
      }

      if (domNode) {
        await this.setCacheValue(id, { ...cache, element: domNode })
      }
    } else {
      let domNode: HTMLElement | undefined
      if (!element) {
        const cacheReference =
          cachedReferences[ref] && cachedReferences[ref].element
        if (cacheReference && document.contains(cacheReference)) {
          console.log('HERE 2')
          if (loaderHTML) {
            cacheReference.appendChild(loaderHTML)
          }
        }
      } else {
        console.log('HERE 4a', element)
        if (typeof element === 'string') {
          domNode = document.querySelector(element)
          if (!domNode) {
            throw new Error(`Cannot find ${element} in the DOM`)
          }
        } else if (element instanceof HTMLElement) {
          domNode = element
        } else if (typeof element === 'object' && !Array.isArray(element)) {
          if ('selector' in element) {
            const { selector } = element
            domNode = document.querySelector(selector)
            if (!domNode) {
              throw new Error(`Cannot find ${selector} in the DOM`)
            }
          } else if ('node' in element) {
            const { node } = element
            domNode = node
          } else {
            throw new Error('Wrong Element provided')
          }
          if (element.shadow) {
            if (
              !Htmlify.allowedElementsForShadowRoot.includes(
                domNode.nodeName.toLowerCase()
              )
            ) {
              throw new Error(
                'The node you provided does not support Shadow Root'
              )
            }
            const shadowRoot =
              domNode.shadowRoot ||
              domNode.attachShadow({
                mode: 'open',
                delegatesFocus: false
              })
            const elementAlreadyInShadowRoot = shadowRoot.querySelector(sel)
            if (elementAlreadyInShadowRoot) {
              domNode = elementAlreadyInShadowRoot as HTMLElement
            } else {
              domNode = document.createElement(type)
              attrs.forEach(({ type: attributeType, value }) =>
                domNode.setAttribute(attributeType, value)
              )
              shadowRoot.appendChild(domNode)
            }
          }
        }
      }

      if (domNode) {
        console.log('SETTINGGGGG')
        await this.setCacheValue(id, {
          ...cache,
          refs: {
            ...cache.refs,
            [ref]: { state: 'idle', element: domNode }
          }
        })
      }
    }
  }
  private async getRepositories(
    args:
      | RendererRenderArguments<AnyAppId>
      | RendererDestroyArguments<AnyAppId>,
    isRendering: boolean
  ): Promise<IRepository> {
    if (!args) {
      let keys = []
      for (const key of this.cache.keys()) {
        isRendering &&
          (await this.createContainer({
            element: undefined,
            id: key,
            loader: false
          }))
        keys.push(key)
      }
      return { ids: new Set(keys) }
    } else if (typeof args === 'string') {
      if (this.checkForElementInCache(args)) {
        isRendering &&
          (await this.createContainer({
            element: undefined,
            id: args,
            loader: false
          }))
        return { ids: new Set(args) }
      }
      throw new Error(`Element ${args} not bound`)
    } else if (Array.isArray(args)) {
      let props: { [key: string]: any } = {}
      let onRender: { [key: string]: (...args: any[]) => void } = {}
      let onDestroy: { [key: string]: (...args: any[]) => void } = {}
      let refs: { [key: string]: Set<string> } = {}
      let ids: string[] = []
      await asyncForEach(
        args as Array<
          (IRenderRender<AnyAppId> & IRenderDestroy<AnyAppId>) | string
        >,
        async appToRender => {
          console.log(appToRender)
          if (typeof appToRender === 'string') {
            if (this.checkForElementInCache(appToRender)) {
              isRendering &&
                (await this.createContainer({
                  element: undefined,
                  id: appToRender,
                  loader: false
                }))
              ids = [...ids, appToRender]
            }
          } else if (has(appToRender, 'id')) {
            const {
              id,
              props: appProps,
              element: appElement,
              loader,
              onDestroy: appOnDestroy,
              onRender: appOnRender,
              ref
            } = appToRender
            if (this.checkForElementInCache(id)) {
              if (appProps) {
                props[id] = appProps
              }
              if (onRender) {
                onRender[ref || id] = appOnRender
              }
              if (onDestroy) {
                onDestroy[ref || id] = appOnDestroy
              }
              if (ref) {
                if (refs[id]) {
                  refs[id].add(ref)
                } else {
                  refs[id] = new Set([ref])
                }
              }
              isRendering &&
                (await this.createContainer({
                  element: appElement,
                  id,
                  loader,
                  ref
                }))
              ids = [...ids, id]
            }
          } else {
            throw new Error('Wrong Arguments supplied')
          }
        }
      )
      return {
        ids: new Set(ids),
        props,
        onRender,
        onDestroy,
        ...(refs && { refs })
      }
    }
    throw new Error('Wrong Arguments supplied')
  }
  private async checkForProcesses() {
    console.log('GIOVANE', this.processes.queue)
    if (this.processes.state === 'idle') {
      this.processes.state = 'running'
      const transaction = Math.min(
        ...Object.keys(this.processes.queue).map(Number)
      )
      if (Number.isFinite(transaction)) {
        const process = this.processes.queue[transaction]
        delete this.processes.queue[transaction]
        console.log({ q: this.processes.queue, transaction, process })
        await process()
        this.processes.processed.push(transaction)
        this.processes.state = 'idle'
        if (Object.keys(this.processes).length) {
          requestAnimationFrame(() => this.checkForProcesses())
        }
      } else {
        this.processes.state = 'idle'
      }
    }
  }
  render(args: RendererRenderArguments<AnyAppId>): void {
    const transaction = new Date().valueOf()
    this.processes.queue[transaction] = async () => {
      const {
        ids: appIds,
        onRender = {},
        props = {},
        refs = {}
      } = await this.getRepositories(args, true)
      console.log({
        appIds,
        onRender,
        refs
      })
      console.log('HERERE', { appIds })
      await asyncForEach(appIds, async id => {
        if (refs[id]) {
          await asyncForEach(refs[id], async ref => {
            const cache = this.getCacheValue(id)
            const refFromCache = cache.refs[ref]
            if (!refFromCache) {
              throw new Error('TODO: ERROR HERE')
            }
            console.log({ ref, cache })
            if (
              cache.state === 'fetched' &&
              (refFromCache.state === 'destroyed' ||
                refFromCache.state === 'rendering' ||
                refFromCache.state === 'idle')
            ) {
              requestAnimationFrame(() => {
                cache.render({
                  props,
                  ...(onRender[ref] && { onRender: onRender[ref] }),
                  element: refFromCache.element
                })
              })
              await this.setCacheValue(id, {
                ...cache,
                subscribers: [],
                refs: {
                  ...cache.refs,
                  [ref]: {
                    ...refFromCache,
                    state: 'rendered'
                  }
                }
              })
              console.log('GETTING', this.getCacheValue(id))
            } else if (refFromCache.state !== 'rendered') {
              console.log('HOLA')
              const self = this
              const f = function() {
                self.render(
                  (args as Array<IRenderRender<AnyAppId>>).filter(arg => {
                    if (arg.ref && arg.ref === ref) return true
                    return false
                  })
                )
              }
              Object.defineProperty(f, 'name', {
                value: `render_${ref}`,
                writable: false
              })
              await this.setCacheValue(id, {
                ...cache,
                subscribers: [
                  ...cache.subscribers.filter(
                    fn => fn.name !== `render_${ref}`
                  ),
                  f
                ],
                refs: {
                  ...cache.refs,
                  [ref]: {
                    ...refFromCache,
                    state: 'rendering'
                  }
                }
              })
            }
          })
        } else {
          const cache = this.getCacheValue(id)
          console.log(cache)
          if (cache.state === 'fetched' || cache.state === 'destroyed') {
            requestAnimationFrame(() => {
              cache.render({
                props,
                ...(onRender[id] && { onRender: onRender[id] }),
                element: cache.element
              })
            })

            await this.setCacheValue(id, {
              ...cache,
              state: 'rendered',
              subscribers: []
            })
          } else if (cache.state !== 'rendered') {
            const self = this
            await this.setCacheValue(id, {
              ...cache,
              subscribers: [
                ...cache.subscribers.filter(fn => fn.name !== 'render'),
                function render() {
                  self.render(
                    (args as Array<IRenderRender<AnyAppId>>).filter(arg => {
                      if (!arg.ref) return true
                      return false
                    })
                  )
                }
              ],
              state: 'rendering'
            })
          }
        }
        return
      })
    }
    this.checkForProcesses()
  }
  destroy(args: RendererDestroyArguments<AnyAppId>): void {
    const transaction = new Date().valueOf()
    this.processes.queue[transaction] = async () => {
      const {
        ids: appIds,
        onDestroy = {},
        refs = {}
      } = await this.getRepositories(args, false)
      await asyncForEach(appIds, async id => {
        const cache = this.getCacheValue(id)
        console.log({ cache, refs, id })
        if (refs[id]) {
          await asyncForEach(refs[id], async ref => {
            const refFromCache = cache.refs[ref]
            if (!refFromCache) {
              throw new Error('TODO: ERROR HERE')
            }
            console.log(refFromCache)
            if (refFromCache.state === 'rendered') {
              requestAnimationFrame(() => {
                cache.destroy({
                  ...(onDestroy[ref] && { onDestroy: onDestroy[ref] }),
                  element: refFromCache.element
                })
              })
              await this.setCacheValue(id, {
                ...cache,
                subscribers: [],
                refs: {
                  ...cache.refs,
                  [ref]: {
                    ...refFromCache,
                    state: 'destroyed'
                  }
                }
              })
            } else if (refFromCache.state == 'rendering') {
              const self = this
              const f = function() {
                self.destroy(
                  (args as Array<IRenderDestroy<AnyAppId>>).filter(arg => {
                    if (arg.ref && arg.ref === ref) return true
                    return false
                  })
                )
              }
              Object.defineProperty(f, 'name', {
                value: `destroy_${ref}`,
                writable: false
              })
              await this.setCacheValue(id, {
                ...cache,
                subscribers: [
                  ...cache.subscribers.filter(
                    fn => fn.name !== `destroy_${ref}`
                  ),
                  f
                ],
                refs: {
                  ...cache.refs,
                  [ref]: {
                    ...refFromCache,
                    state: 'destroying'
                  }
                }
              })
            }
          })
        } else {
          if (cache.state === 'rendered') {
            requestAnimationFrame(() => {
              cache.destroy({
                ...(onDestroy[id] && { onDestroy: onDestroy[id] }),
                element: cache.element
              })
            })
            await this.setCacheValue(id, {
              ...cache,
              state: 'destroyed',
              subscribers: []
            })
          } else if (cache.state === 'rendering') {
            const self = this
            await this.setCacheValue(id, {
              ...cache,
              subscribers: [
                ...cache.subscribers.filter(fn => fn.name !== 'destroy'),
                function destroy() {
                  self.destroy(
                    (args as Array<IRenderDestroy<AnyAppId>>).filter(arg => {
                      if (!arg.ref) return true
                      return false
                    })
                  )
                }
              ],
              state: 'destroying'
            })
          }
        }
        return
      })
    }
    this.checkForProcesses()
  }
}
