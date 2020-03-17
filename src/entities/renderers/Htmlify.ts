import { injectable, inject } from 'inversify'
import 'reflect-metadata'
import {
  IRenderer,
  IConfigurer,
  RendererRenderArguments,
  RendererDestroyArguments,
  IInjector,
  ProxyValues,
  IRendererRender,
  IRenderDestroy,
  IRendererContextValues,
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
  HubsterEventArguments,
  IContexter,
  Context
} from '../../utils/types'
import { createLoader } from '../../utils/createLoader'
import {
  has,
  isArray,
  isObject,
  defaultFromPath,
  isString
} from '../../utils/helpers'
import { Hubster } from '../../entities/Hubster'
import { EHubsterEvents, ETypes, ERendererStates } from '../../utils/enums'

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
  private context: Context<IRendererContextValues>
  @inject(ETypes.ASYNC) private async: IAsync
  @inject(ETypes.INJECTOR) private injector: IInjector
  @inject(ETypes.CONTEXTER) private contexter: IContexter
  init(configurer: IConfigurer, transactor: ITransactor): void {
    this.context = this.contexter.createContext<IRendererContextValues>()
    this.configurer = configurer
    this.transactor = transactor
    this.injector.setTransactor(transactor)
  }
  private hasElementInContext(id: string): boolean {
    if (this.context.has(id)) {
      return true
      //throw new Error(`Please provide correct app name: ${id} does not exists`)
    }
    return false
  }
  private getContext(id: string): IRendererContextValues {
    if (this.hasElementInContext(id)) {
      return this.context[id]
    }
    return {
      selector: {
        sel: '',
        attrs: [],
        type: ''
      },
      dependencies: [],
      url: '',
      subscribers: [],
      render: undefined,
      destroy: undefined,
      state: ERendererStates.IDLE,
      element: undefined,
      refs: {}
    }
    // TODO think about if empty object are good
    // throw new Error(`wrong key ( ${id} ) provided`)
  }
  private async setContext(
    id: string,
    updater:
      | ((context: IRendererContextValues) => Partial<IRendererContextValues>)
      | Partial<IRendererContextValues>
  ): Promise<void> {
    return await this.async.setMutex(async () => {
      const context = this.getContext(id)
      this.context.set(
        id,
        Object.assign(
          context,
          typeof updater === 'function' ? updater.call(this, context) : updater
        )
      )
    })
  }
  private setProxy(id: string) {
    const handler = {
      set: (obj, prop: ProxyValues, value: (...args: []) => {}) => {
        if (prop === EHubsterEvents.RENDER) {
          this.transactor.setTransaction(async () => {
            await this.setContext(id, {
              render: value
            })
            const context = this.getContext(id)
            if (context.render && context.destroy) {
              context.subscribers.map(fn => {
                fn()
              })
            }
          })
        }
        if (prop === EHubsterEvents.DESTROY) {
          this.transactor.setTransaction(async () => {
            await this.setContext(id, {
              destroy: value
            })
            const context = this.getContext(id)
            if (context.render && context.destroy) {
              context.subscribers.map(fn => {
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
        if (this.hasElementInContext(id)) {
          return
        }
        const selector = this.configurer.getAppDefaultSelector(id)
        const dependencies = this.configurer.getAppDependencies(id)
        const url = this.configurer.getAppUrl(id)

        this.setProxy(id)

        await this.setContext(id, {
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
      this.injector.fetchDependencies(appIds, {
        get: this.getContext.bind(this),
        set: this.setContext.bind(this)
      })
    })
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
      ref
    } = args

    let domNode: HTMLElement | undefined
    if (!element) {
      // in case no element has been provided with the render call

      if (appElement && document.contains(appElement)) {
        // if the context has an element saved already an this element is mounted in the DOM
        this.mountLoader(loader, appElement)
      } else if (!ref && document.querySelector(sel)) {
        // if the element is the one from the default provided / auto generated selector and is in the DOM
        domNode = document.querySelector(sel)
        this.mountLoader(loader, domNode)
      } else if (!ref) {
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
      if (isString(element)) {
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
          if (!document.contains(node)) {
            throw new Error('The provided node is not in the DOM')
          }
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
          const id = sel.replace(/[^\w\s]/gi, '')
          const shadowElementId = `${ref || id}_shadow`
          const elementAlreadyInShadowRoot = shadowRoot.querySelector(
            `#${shadowElementId}`
          )
          if (elementAlreadyInShadowRoot) {
            domNode = elementAlreadyInShadowRoot as HTMLElement
          } else {
            domNode = document.createElement(type)
            domNode.setAttribute('id', shadowElementId)
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

    const context = this.getContext(id)

    const { selector, element: appElement, refs: contextdReferences } = context

    if (
      (!ref && context.state === ERendererStates.RENDERED) ||
      (has(contextdReferences, ref) &&
        contextdReferences[ref].state === ERendererStates.RENDERED)
    ) {
      // in this case the "main" app is just trying to rerender
      // OR in this case the ref in already in the context and the element is rendered
      return
    }
    let domNode: HTMLElement | undefined = this.createDomNode({
      element,
      appElement: !ref
        ? appElement
        : defaultFromPath<HTMLElement>(
            document.createElement('div'),
            [ref, 'element'],
            contextdReferences
          ),
      loader,
      selector,
      ref
    })

    if (domNode) {
      if (ref) {
        await this.setContext(id, ({ refs }) => {
          return {
            refs: {
              ...refs,
              [ref]: { state: ERendererStates.IDLE, element: domNode }
            }
          }
        })
      } else {
        await this.setContext(id, { element: domNode })
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
      // if the user didn't provide anything to the render / destroy function means that only the keys will be provided from the context / created
      // no refs will be rendered
      let keys = []
      for (const key of this.context.keys()) {
        if (typeof key === 'string') {
          isRendering &&
            (await this.createContainer({
              element: undefined,
              id: key,
              loader: false
            }))
          keys = [...keys, key]
        }
      }
      return { ids: new Set(keys) }
    } else if (isString(args)) {
      // if the user provided a string to the render / destroy function means that only that one will be provided from the context / created
      // no refs will be rendered
      if (this.hasElementInContext(args)) {
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
        if (isString(appToRender)) {
          // in this case the argument is the id of the app to render ( no refs allowed )
          if (this.hasElementInContext(appToRender)) {
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
          if (this.hasElementInContext(id)) {
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
            const context = this.getContext(id)
            const refFromContext = context.refs[ref]
            if (!refFromContext) {
              throw new Error('TODO: ERROR HERE')
            }
            if (
              context.state !== ERendererStates.IDLE &&
              (refFromContext.state === ERendererStates.DESTROYED ||
                refFromContext.state === ERendererStates.IDLE)
            ) {
              requestAnimationFrame(() => {
                // TODO check how props are passed here
                context.render({
                  ...(props[ref] && { props: props[ref] }),
                  ...(onRender[ref] && { onRender: onRender[ref] }),
                  element: refFromContext.element
                })
              })
              await this.setContext(id, ({ refs: latestRefs }) => {
                return {
                  subscribers: [],
                  refs: {
                    ...latestRefs,
                    [ref]: {
                      ...latestRefs[ref],
                      state: ERendererStates.RENDERED
                    }
                  }
                }
              })
            } else if (refFromContext.state !== ERendererStates.RENDERED) {
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
                value: `render_${ref}`,
                writable: false
              })
              await this.setContext(id, ({ refs: latestRefs }) => {
                return {
                  subscribers: [
                    ...context.subscribers.filter(
                      fn => fn.name !== `render_${ref}`
                    ),
                    f
                  ],
                  refs: {
                    ...latestRefs,
                    [ref]: {
                      ...latestRefs[ref],
                      state: ERendererStates.RENDERING
                    }
                  }
                }
              })
            }
          })
        } else {
          const context = this.getContext(id)
          if (
            context.state == ERendererStates.FETCHED ||
            context.state === ERendererStates.DESTROYED
          ) {
            requestAnimationFrame(() => {
              context.render({
                ...(props[id] && { props: props[id] }),
                ...(onRender[id] && { onRender: onRender[id] }),
                element: context.element
              })
            })

            await this.setContext(id, {
              state: ERendererStates.RENDERED,
              subscribers: []
            })
          } else if (context.state !== ERendererStates.RENDERED) {
            const self = this
            await this.setContext(id, ({ subscribers }) => {
              return {
                subscribers: [
                  ...subscribers.filter(fn => fn.name !== 'render'),
                  function render() {
                    if (isArray(args)) {
                      self.render(
                        args.filter(argument => {
                          // in this instance put in the render queue only elements that have no ref attribute - hence the "main" app
                          if (isString(argument) || !argument.ref) {
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
              }
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
        const context = this.getContext(id)
        if (refs[id]) {
          await this.async.forEach<string>(refs[id], async ref => {
            const refFromContext = context.refs[ref]
            if (!refFromContext) {
              //  throw new Error('TODO: ERROR HERE')
              return
            }
            if (refFromContext.state === ERendererStates.RENDERED) {
              requestAnimationFrame(() => {
                context.destroy({
                  ...(onDestroy[ref] && { onDestroy: onDestroy[ref] }),
                  element: refFromContext.element
                })
              })
              await this.setContext(id, ({ refs: latestRefs }) => {
                return {
                  subscribers: [],
                  refs: {
                    ...latestRefs,
                    [ref]: {
                      ...latestRefs[ref],
                      state: ERendererStates.DESTROYED
                    }
                  }
                }
              })
            } else if (refFromContext.state == ERendererStates.RENDERING) {
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
                value: `destroy_${ref}`,
                writable: false
              })
              await this.setContext(id, ({ refs: latestRefs, subscribers }) => {
                return {
                  subscribers: [
                    ...subscribers.filter(fn => fn.name !== `destroy_${ref}`),
                    f
                  ],
                  refs: {
                    ...latestRefs,
                    [ref]: {
                      ...latestRefs[ref],
                      state: ERendererStates.DESTROYNG
                    }
                  }
                }
              })
            }
          })
        } else {
          if (context.state === ERendererStates.RENDERED) {
            requestAnimationFrame(() => {
              context.destroy({
                ...(onDestroy[id] && { onDestroy: onDestroy[id] }),
                element: context.element
              })
            })
            await this.setContext(id, {
              state: ERendererStates.DESTROYED,
              subscribers: []
            })
          } else if (context.state === ERendererStates.RENDERING) {
            const self = this
            await this.setContext(id, ({ subscribers }) => {
              return {
                subscribers: [
                  ...subscribers.filter(fn => fn.name !== 'destroy'),
                  function destroy() {
                    if (isArray(args)) {
                      self.destroy(
                        args.filter(argument => {
                          // in this instance put in the destroy queue only elements that have no ref attribute - hence the "main" app
                          if (isString(argument) || !argument.ref) {
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
              }
            })
          }
        }
        return
      })
    })
  }
}
