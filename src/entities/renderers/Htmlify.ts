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
  IContainerCreator
} from '../../types'
import { createLoader } from '../../utils/createLoader'
import { has } from '../../utils/has'
import { Hubster } from '../../Hubster'

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
          cache.render = value
        }
        if (prop === 'destroy') {
          cache.destroy = value
        }
        obj[prop] = value
        if (cache.render && cache.destroy) {
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

    if (!has(Hubster.on, id)) Hubster.on[id] = new Proxy({}, handler)
  }

  public create(appIds: string[]): void {
    appIds.forEach(id => {
      if (this.cache.has(id)) {
        return
      }
      const selector = this.configurer.getAppDefaultSelector(id)
      const dependencies = this.configurer.getAppDependencies(id)
      const url = this.configurer.getAppUrl(id)

      this.setProxy(id)

      this.setCacheValue(id, {
        selector,
        dependencies,
        url,
        subscribers: [],
        render: undefined,
        destroy: undefined,
        state: 'idle',
        element: undefined
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
  private createContainer(args: IContainerCreator): void {
    const { loader, id, element } = args
    const cache = this.getCacheValue(id)
    if (cache.state === 'rendered') return
    const {
      selector: { type, attrs, sel },
      element: domReference
    } = cache

    let loaderHTML: HTMLElement
    if (loader) {
      if (typeof loader === 'boolean') {
        loaderHTML = createLoader()
      } else {
        loaderHTML = loader
      }
    }

    let domNode: HTMLElement | undefined

    if (!element) {
      // in case no element has been provided with the render call

      if (domReference && document.contains(domReference)) {
        console.log('HERE 2')
        if (loaderHTML) {
          domReference.appendChild(loaderHTML)
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
      console.log('HERE 4', typeof element)
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
      this.setCacheValue(id, { ...cache, element: domNode })
    }
  }
  private getRepositories(
    args:
      | RendererRenderArguments<AnyAppId>
      | RendererDestroyArguments<AnyAppId>,
    isRendering: boolean
  ): IRepository {
    if (!args) {
      let keys = []
      for (const key of this.cache.keys()) {
        isRendering &&
          this.createContainer({
            element: undefined,
            id: key,
            loader: false
          })
        keys.push(key)
      }
      return { ids: keys }
    } else if (typeof args === 'string') {
      if (this.checkForElementInCache(args)) {
        isRendering &&
          this.createContainer({
            element: undefined,
            id: args,
            loader: false
          })
        return { ids: [args] }
      }
      throw new Error(`Element ${args} not bound`)
    } else if (Array.isArray(args)) {
      let props: { [key: string]: any } = {}
      let onRender: { [key: string]: (...args: any[]) => void } = {}
      let onDestroy: { [key: string]: (...args: any[]) => void } = {}
      const ids = (args as Array<
        (IRenderRender<AnyAppId> & IRenderDestroy<AnyAppId>) | string
      >).map(appToRender => {
        if (typeof appToRender === 'string') {
          if (this.checkForElementInCache(appToRender)) {
            isRendering &&
              this.createContainer({
                element: undefined,
                id: appToRender,
                loader: false
              })
            return appToRender
          }
        } else if (has(appToRender, 'id')) {
          const {
            id,
            props: appProps,
            element: appElement,
            loader,
            onDestroy: appOnDestroy,
            onRender: appOnRender
          } = appToRender
          if (this.checkForElementInCache(id)) {
            if (appProps) {
              props[id] = appProps
            }
            if (onRender) {
              onRender[id] = appOnRender
            }
            if (onDestroy) {
              onDestroy[id] = appOnDestroy
            }
            isRendering &&
              this.createContainer({
                element: appElement,
                id,
                loader
              })
            return id
          }
        }
        throw new Error('Wrong Arguments supplied')
      })
      return { ids, props, onRender, onDestroy }
    }
    throw new Error('Wrong Arguments supplied')
  }
  render(args: RendererRenderArguments<AnyAppId>): void {
    const { ids: appIds, onRender = {}, props = {} } = this.getRepositories(
      args,
      true
    )

    appIds.map(id => {
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
        this.setCacheValue(id, {
          ...cache,
          state: 'rendered',
          subscribers: []
        })
      } else if (cache.state !== 'rendered') {
        const self = this
        this.setCacheValue(id, {
          ...cache,
          subscribers: [
            ...cache.subscribers.filter(fn => fn.name !== 'render'),
            function render() {
              self.render(args)
            }
          ],
          state: 'rendering'
        })
      }
    })
    return
  }
  destroy(args: RendererDestroyArguments<AnyAppId>): void {
    const { ids: appIds, onDestroy = {} } = this.getRepositories(args, false)
    appIds.map(id => {
      const cache = this.getCacheValue(id)
      if (cache.state === 'rendered') {
        requestAnimationFrame(() => {
          cache.destroy({
            ...(onDestroy[id] && { onDestroy: onDestroy[id] }),
            element: cache.element
          })
        })
        this.setCacheValue(id, {
          ...cache,
          state: 'destroyed',
          subscribers: []
        })
      } else if (cache.state === 'rendering') {
        const self = this
        this.setCacheValue(id, {
          ...cache,
          subscribers: [
            ...cache.subscribers.filter(fn => fn.name !== 'destroy'),
            function destroy() {
              self.destroy(args)
            }
          ],
          state: 'destroying'
        })
      }
    })
    return
  }
}
