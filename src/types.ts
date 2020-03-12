// for enforcement
export type AnyAppId = string
export type Callback = (...args: any[]) => void | any
export type EventValues = ProxyValues
interface IElementAttribute {
  type: string
  value: string
}
export interface IResource {
  text: string
  position: number
  app: number | undefined
}
export interface IGlobalDependency {
  name: string
  id: string
  url: string
  global_object: string
}
export interface IAppSelector {
  type: string
  sel: string
  attrs: IElementAttribute[]
}
export interface IApp<T> {
  name: string
  id: T
  el?: IAppSelector
  global_dependencies: string[]
  url: string
}
export interface IConfiguration<T extends AnyAppId> {
  apps: IApp<T>[]
  global_dependencies: IGlobalDependency[]
}
export type OnEventFunction = (
  event: EventValues,
  id: string,
  callback: Callback
) => any | void

/**
 *
 * For Renderer
 */
export type RendererState =
  | 'idle'
  | 'fetched'
  | 'fetching'
  | 'mounted'
  | 'mounting'
  | 'destroyed'
  | 'destroying'

export interface IRendererCacheValues {
  selector: IAppSelector
  dependencies: IGlobalDependency[]
  url: string
  subscribers: Array<Callback>
  mount: (...args: any) => any
  unmount: (...args: any) => any
  state: RendererState
  element: HTMLElement | undefined
}
export type IRendererCache = Map<string, IRendererCacheValues>
export interface IRenderElement {
  shadow?: boolean
}
export interface IRenderElementWithSelector extends IRenderElement {
  selector: string
}
export interface IRenderElementWithNode extends IRenderElement {
  node: HTMLElement
}

export type RenderMountElement =
  | HTMLElement
  | IRenderElementWithSelector
  | IRenderElementWithNode
  | string

export interface IRenderMount<T> {
  id: T
  props?: { [key: string]: any }
  loader?: boolean | HTMLElement
  element?: RenderMountElement
  onRender?: Callback
}
export interface IRenderUnmount<T> {
  id: T
  onDestroy?: Callback
}

export type RendererMountArguments<AppId extends AnyAppId> =
  | Array<IRenderMount<AppId> | AppId>
  | AppId
  | void
export type RendererUnmountArguments<AppId extends AnyAppId> =
  | Array<IRenderUnmount<AppId> | AppId>
  | AppId
  | void
export type ResourceType = 'script'
export type ProxyValues = 'render' | 'unmount'

export interface IRepository {
  ids: string[]
  props?: { [key: string]: any }
  onMount?: { [key: string]: Callback }
  onUnmount?: { [key: string]: Callback }
}
export interface IContainerCreator {
  id: string
  loader?: HTMLElement | boolean
  element: RenderMountElement | undefined
}
/**
 * For Injector
 */
export interface IInjectorResource {
  text: string
  position: number
  appId: string | undefined
}

export type Thenable = { ['then']: Callback }
export interface IInjectorStatePromises {
  deferreds: Promise<{ [key: string]: any }>[]
  thenables: Thenable[]
}
export type InjectorState = Map<number, () => Promise<any>>
export interface ISortedDependencies {
  globalDependencies: string[]
  appDependencies: { [key: string]: string }
}
export interface ITemporaryDependencies {
  global: { [key: string]: IGlobalDependency }
  apps: { [key: string]: string }
}

/**
 * main Interfaces
 */
export const TYPES = {
  IHubster: Symbol.for('IHubster'),
  IConfigurer: Symbol.for('IConfigurer'),
  IRenderer: Symbol.for('IRenderer'),
  IFetcher: Symbol.for('IFetcher'),
  IInjector: Symbol.for('IInjector')
}

export interface IConfigurer {
  getAppDefaultSelector(appId: string): IAppSelector
  getAppUrl(appId: string): string
  getAppDependencies(appId: string): IGlobalDependency[]
  setConfiguration<AppId extends AnyAppId>(
    configuration: IConfiguration<AppId>
  ): void
}
export interface IFetcher {
  getJson<T>(url: string): Promise<T>
  getText(url: string): Promise<string>
}
export interface IRenderer<AppId extends AnyAppId> {
  setConfigurer(configurer: IConfigurer): void
  create(appIds: string[]): void
  mount(args: RendererMountArguments<AppId>): void
  unmount(args: RendererUnmountArguments<AppId>): void
}
export interface IInjector {
  fetchDependencies(appIds: string[], cache: IRendererCache): void
}
export interface IHubster<AppId extends AnyAppId> {
  bind(appIds: AppId[]): IHubster<AppId>
  render(args: RendererMountArguments<AppId>): void
  destroy(args: RendererUnmountArguments<AppId>): void
}
