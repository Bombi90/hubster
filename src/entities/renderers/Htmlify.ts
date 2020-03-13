import { injectable, inject } from 'inversify'
import 'reflect-metadata'
import {
  IRenderer,
  IConfigurer,
  RendererRenderArguments,
  RendererDestroyArguments,
  IRendererCache,
  IInjector,
  ProxyValues,
  IRendererRender,
  IRenderDestroy,
  IRendererCacheValues,
  IRepository,
  AnyAppId,
  IContainerCreator,
  ITransactor,
  IAsync,
  ICreateDomNode,
  Loader,
  Props,
  Callback,
  ObjectOf,
  HubsterEvents,
  HubsterEventArguments
} from '../../types'
import { createLoader } from '../../utils/createLoader'
import { has } from '../../utils/has'
import { Hubster } from '../../Hubster'
import { isArray } from '../../utils/isArray'
import { isObject } from '../../utils/isObject'
import { defaultFromPath } from '../../utils/defaultFromPath'
import { EHubsterEvents, ETypes, ERendererStates } from '../../enums'

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
  @inject(ETypes.ASYNC) private async: IAsync
  @inject(ETypes.INJECTOR) injector: IInjector
  init(configurer: IConfigurer, transactor: ITransactor): void {
    this.configurer = configurer
    this.transactor = transactor
    this.injector.setTransactor(transactor)
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
    //TODO: MAKE CACHE DIFF AND RETURN A CALLBACK
    return await this.async.setMutex(async () => {
      this.cache.set(id, value)
    })
  }
  private setProxy(id: string) {
    const handler = {
      set: (obj, prop: ProxyValues, value: (...args: []) => {}) => {
        if (prop === EHubsterEvents.RENDER) {
          this.transactor.setTransaction(async () => {
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
          })
        }
        if (prop === EHubsterEvents.DESTROY) {
          this.transactor.setTransaction(async () => {
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
          })
        }
        obj[prop] = value
        return true
      }
    }

    if (!has(Hubster.on, id)) Hubster.on[id] = new Proxy({}, handler)
  }

  public create(appIds: string[]): void {
    this.transactor.setTransaction(async () => {
      await this.async.forEach<string>(appIds, async id => {
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
          state: ERendererStates.IDLE,
          element: undefined,
          refs: {}
        })
      })
      this.injector.fetchDependencies(appIds, this.cache)
    })
  }
  private checkForElementInCache(id: string): boolean {
    if (!this.cache.has(id)) {
      throw new Error(`Please provide correct app name: ${id} does not exists`)
    }
    return true
  }
  private createLoader(loader: Loader): HTMLElement | void {
    if (loader) {
      if (typeof loader === 'boolean') {
        return createLoader()
      } else {
        return loader
      }
    }
  }
  private mountLoader(loader: Loader, element: HTMLElement) {
    let loaderHTML: HTMLElement | void = this.createLoader(loader)
    if (loaderHTML) {
      element.appendChild(loaderHTML)
    }
  }

  private createDomNode(args: ICreateDomNode): HTMLElement | undefined {
    const {
      element,
      appElement,
      loader,
      selector: { sel, type, attrs },
      isRef
    } = args

    let domNode: HTMLElement | undefined
    if (!element) {
      // in case no element has been provided with the render call

      if (appElement && document.contains(appElement)) {
        // if the cache has an element saved already an this element is mounted in the DOM
        this.mountLoader(loader, appElement)
      } else if (!isRef && document.querySelector(sel)) {
        // if the element is the one from the default provided / auto generated selector and is in the DOM
        domNode = document.querySelector(sel)
        this.mountLoader(loader, domNode)
      } else if (!isRef) {
        // if there's nothing in the DOM make one from the provided / auto generated selector
        domNode = document.createElement(type)
        attrs.forEach(({ type: attributeType, value }) =>
          domNode.setAttribute(attributeType, value)
        )
        this.mountLoader(loader, domNode)
        document.body.appendChild(domNode)
      }
    } else {
      // in case some element in some shape has been provided with the render call
      if (typeof element === 'string') {
        // if the element is a string - means is a selector - Must be then in the DOM
        domNode = document.querySelector(element)
        this.mountLoader(loader, domNode)
        if (!domNode) {
          throw new Error(`Cannot find ${element} in the DOM`)
        }
      } else if (element instanceof HTMLElement) {
        // if the element is already a DOM Element
        domNode = element
        this.mountLoader(loader, domNode)
      } else if (isObject(element)) {
        // if the element is an object with some more data provided i.e. selector - node - shadow
        if ('selector' in element) {
          // if the object contains selector - meaning that has to be queried from the DOM
          const { selector } = element
          domNode = document.querySelector(selector)
          if (!domNode) {
            throw new Error(`Cannot find ${selector} in the DOM`)
          }
          this.mountLoader(loader, domNode)
        } else if ('node' in element) {
          // if the object contains node - meaning that we have already the DOM Element
          const { node } = element
          domNode = node
          this.mountLoader(loader, domNode)
        } else {
          throw new Error('Wrong Element provided')
        }
        if (element.shadow) {
          // if the object contains shadow - meaning that we have to render the element in the Shadow Root
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
            this.mountLoader(loader, domNode)
          }
        }
      }
    }
    return domNode
  }
  private async createContainer(args: IContainerCreator): Promise<void> {
    const { loader, id, element, ref } = args

    const cache = this.getCacheValue(id)

    const { selector, element: appElement, refs: cachedReferences } = cache

    if (
      (!ref && cache.state === ERendererStates.RENDERED) ||
      (has(cachedReferences, ref) &&
        cachedReferences[ref].state === ERendererStates.RENDERED)
    ) {
      // in this case the "main" app is just trying to rerender
      // OR in this case the ref in already in the cache and the element is rendered
      return
    }
    let domNode: HTMLElement | undefined = this.createDomNode({
      element,
      appElement: !ref
        ? appElement
        : defaultFromPath<HTMLElement>(
            document.createElement('div'),
            [ref, 'element'],
            cachedReferences
          ),
      loader,
      selector,
      isRef: !!ref
    })

    if (domNode) {
      if (ref) {
        await this.setCacheValue(id, {
          ...cache,
          refs: {
            ...cache.refs,
            [ref]: { state: ERendererStates.IDLE, element: domNode }
          }
        })
      } else {
        await this.setCacheValue(id, { ...cache, element: domNode })
      }
    }
  }
  private async getRepositories(
    args:
      | RendererRenderArguments<AnyAppId>
      | RendererDestroyArguments<AnyAppId>,
    isRendering: boolean
  ): Promise<IRepository> {
    // The function will return an object ( Repository ) with the data required in order to be rendered / destroyed
    if (!args) {
      // if the user didn't provide anything to the render / destroy function means that only the keys will be provided from the cache / created
      // no refs will be rendered
      let keys = []
      for (const key of this.cache.keys()) {
        isRendering &&
          (await this.createContainer({
            element: undefined,
            id: key,
            loader: false
          }))
        keys = [...keys, key]
      }
      return { ids: new Set(keys) }
    } else if (typeof args === 'string') {
      // if the user provided a string to the render / destroy function means that only that one will be provided from the cache / created
      // no refs will be rendered
      if (this.checkForElementInCache(args)) {
        isRendering &&
          (await this.createContainer({
            element: undefined,
            id: args,
            loader: false
          }))
        return { ids: new Set([args]) }
      }
      throw new Error(`Element ${args} not bound`)
    } else if (isArray(args)) {
      // in this case could be an array of strings or array of objects
      let repositoryProps: Props = {}
      let repositoryOnRender: ObjectOf<Callback> = {}
      let repositoryOnDestroy: ObjectOf<Callback> = {}
      let repositoryRefs: ObjectOf<Set<string>> = {}
      let repositoryIds: string[] = []
      await this.async.forEach<
        (IRendererRender<AnyAppId> & IRenderDestroy<AnyAppId>) | string
      >(args, async appToRender => {
        if (typeof appToRender === 'string') {
          // in this case the argument is the id of the app to render ( no refs allowed )
          if (this.checkForElementInCache(appToRender)) {
            isRendering &&
              (await this.createContainer({
                element: undefined,
                id: appToRender,
                loader: false
              }))
            repositoryIds = [...repositoryIds, appToRender]
          }
        } else if (has(appToRender, 'id')) {
          // if the arguments have an id in the object then means that this is the case where different things can be provided
          const {
            id,
            props,
            element,
            loader,
            onDestroy,
            onRender,
            ref
          } = appToRender
          if (this.checkForElementInCache(id)) {
            if (props) {
              repositoryProps[ref || id] = props
            }
            if (onRender) {
              repositoryOnRender[ref || id] = onRender
            }
            if (onDestroy) {
              repositoryOnDestroy[ref || id] = onDestroy
            }
            if (ref) {
              if (repositoryRefs[id]) {
                repositoryRefs[id].add(ref)
              } else {
                repositoryRefs[id] = new Set([ref])
              }
            }
            isRendering &&
              (await this.createContainer({
                element,
                id,
                loader,
                ref
              }))
            repositoryIds = [...repositoryIds, id]
          }
        } else {
          throw new Error('Wrong Arguments supplied')
        }
      })
      return {
        ids: new Set(repositoryIds),
        props: repositoryProps,
        onRender: repositoryOnRender,
        onDestroy: repositoryOnDestroy,
        refs: repositoryRefs
      }
    }
    throw new Error('Wrong Arguments supplied')
  }
  trigger(
    event: HubsterEvents,
    args: HubsterEventArguments<AnyAppId, EHubsterEvents.DESTROY>
  ): void
  trigger(
    event: HubsterEvents,
    args: HubsterEventArguments<AnyAppId, EHubsterEvents.RENDER>
  ): void {
    if (event === EHubsterEvents.RENDER) {
      this.render(args)
    } else if (event === EHubsterEvents.DESTROY) {
      this.destroy(args)
    }
  }

  private render(args: RendererRenderArguments<AnyAppId>): void {
    this.transactor.setTransaction(async () => {
      const { ids: appIds, onRender, props, refs } = await this.getRepositories(
        args,
        true
      )

      await this.async.forEach<string>(appIds, async id => {
        // iterate through every "main" app id got from the Repositories
        if (has(refs, id)) {
          // in this case some objects with ref are provided - in this instance  objects with no refs are not rendered
          await this.async.forEach<string>(refs[id], async ref => {
            const cache = this.getCacheValue(id)
            const refFromCache = cache.refs[ref]
            if (!refFromCache) {
              throw new Error('TODO: ERROR HERE')
            }
            if (
              cache.state === ERendererStates.FETCHED &&
              (refFromCache.state === ERendererStates.DESTROYED ||
                refFromCache.state === ERendererStates.IDLE)
            ) {
              requestAnimationFrame(() => {
                cache.render({
                  ...(props[ref] && { props: props[ref] }),
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
                    state: ERendererStates.RENDERED
                  }
                }
              })
            } else if (refFromCache.state !== ERendererStates.RENDERED) {
              const self = this
              const f = function() {
                if (isArray(args)) {
                  self.render(
                    args.filter(argument => {
                      // in this instance put in the destroy queue only elements that have no ref attribute - hence the "main" app
                      if (isObject(argument) && argument.ref) {
                        return true
                      } else {
                        return false
                      }
                    })
                  )
                } else {
                  self.render(args)
                }
              }
              Object.defineProperty(f, 'name', {
                value: `rendering_${ref}`,
                writable: false
              })
              await this.setCacheValue(id, {
                ...cache,
                subscribers: [
                  ...cache.subscribers.filter(
                    fn => fn.name !== `rendering_${ref}`
                  ),
                  f
                ],
                refs: {
                  ...cache.refs,
                  [ref]: {
                    ...refFromCache,
                    state: ERendererStates.RENDERING
                  }
                }
              })
            }
          })
        } else {
          const cache = this.getCacheValue(id)
          if (
            cache.state === ERendererStates.FETCHED ||
            cache.state === ERendererStates.DESTROYED
          ) {
            requestAnimationFrame(() => {
              cache.render({
                props,
                ...(onRender[id] && { onRender: onRender[id] }),
                element: cache.element
              })
            })

            await this.setCacheValue(id, {
              ...cache,
              state: ERendererStates.RENDERED,
              subscribers: []
            })
          } else if (cache.state !== ERendererStates.RENDERED) {
            const self = this
            await this.setCacheValue(id, {
              ...cache,
              subscribers: [
                ...cache.subscribers.filter(fn => fn.name !== 'render'),
                function render() {
                  if (isArray(args)) {
                    self.render(
                      args.filter(argument => {
                        // in this instance put in the render queue only elements that have no ref attribute - hence the "main" app
                        if (typeof argument === 'string' || !argument.ref) {
                          return true
                        } else {
                          return false
                        }
                      })
                    )
                  } else {
                    self.render(args)
                  }
                }
              ],
              state: ERendererStates.RENDERING
            })
          }
        }
        return
      })
    })
  }
  private destroy(args: RendererDestroyArguments<AnyAppId>): void {
    this.transactor.setTransaction(async () => {
      const {
        ids: appIds,
        onDestroy = {},
        refs = {}
      } = await this.getRepositories(args, false)
      await this.async.forEach<string>(appIds, async id => {
        const cache = this.getCacheValue(id)
        if (refs[id]) {
          await this.async.forEach<string>(refs[id], async ref => {
            const refFromCache = cache.refs[ref]
            if (!refFromCache) {
              //  throw new Error('TODO: ERROR HERE')
              return
            }
            if (refFromCache.state === ERendererStates.RENDERED) {
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
                    state: ERendererStates.DESTROYED
                  }
                }
              })
            } else if (refFromCache.state == ERendererStates.RENDERING) {
              const self = this
              const f = function() {
                if (isArray(args)) {
                  self.destroy(
                    args.filter(argument => {
                      // in this instance put in the destroy queue only elements that have no ref attribute - hence the "main" app
                      if (isObject(argument) && argument.ref) {
                        return true
                      } else {
                        return false
                      }
                    })
                  )
                } else {
                  self.destroy(args)
                }
              }
              Object.defineProperty(f, 'name', {
                value: `destroying_${ref}`,
                writable: false
              })
              await this.setCacheValue(id, {
                ...cache,
                subscribers: [
                  ...cache.subscribers.filter(
                    fn => fn.name !== `destroying_${ref}`
                  ),
                  f
                ],
                refs: {
                  ...cache.refs,
                  [ref]: {
                    ...refFromCache,
                    state: ERendererStates.DESTROYNG
                  }
                }
              })
            }
          })
        } else {
          if (cache.state === ERendererStates.RENDERED) {
            requestAnimationFrame(() => {
              cache.destroy({
                ...(onDestroy[id] && { onDestroy: onDestroy[id] }),
                element: cache.element
              })
            })
            await this.setCacheValue(id, {
              ...cache,
              state: ERendererStates.DESTROYED,
              subscribers: []
            })
          } else if (cache.state === ERendererStates.RENDERING) {
            const self = this
            await this.setCacheValue(id, {
              ...cache,
              subscribers: [
                ...cache.subscribers.filter(fn => fn.name !== 'destroy'),
                function destroy() {
                  if (isArray(args)) {
                    self.destroy(
                      args.filter(argument => {
                        // in this instance put in the destroy queue only elements that have no ref attribute - hence the "main" app
                        if (typeof argument === 'string' || !argument.ref) {
                          return false
                        } else {
                          return true
                        }
                      })
                    )
                  } else {
                    self.destroy(args)
                  }
                }
              ],
              state: ERendererStates.DESTROYNG
            })
          }
        }
        return
      })
    })
  }
}
