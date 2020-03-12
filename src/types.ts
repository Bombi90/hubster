// for enforcement
export type AnyAppId = string
export type Callback = (...args: any[]) => void | any
export type EventValues = ProxyValues
export type Props = { [key: string]: any }
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
  | 'rendered'
  | 'destroyed'
  | 'rendering'
  | 'destroying'
type OnRenderTypeArgs = {
  props: Props
  onRender?: Callback
  element: HTMLElement
}
type OnDestroyTypeArgs = { onDestroy?: Callback; element: HTMLElement }
export type OnRenderType = (args: OnRenderTypeArgs) => any
export type OnDestroyType = (args: OnDestroyTypeArgs) => any
export interface IRendererCacheValues {
  selector: IAppSelector
  dependencies: IGlobalDependency[]
  url: string
  subscribers: Array<Callback>
  render: OnRenderType
  destroy: OnDestroyType
  state: RendererState
  element: HTMLElement | undefined
  refs: { [key: string]: { element: HTMLElement; state: RendererState } }
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

export type RenderRenderElement =
  | HTMLElement
  | IRenderElementWithSelector
  | IRenderElementWithNode
  | string

export interface IRenderRender<T> {
  id: T
  props?: { [key: string]: any }
  loader?: boolean | HTMLElement
  element?: RenderRenderElement
  onRender?: Callback
  ref?: string
}
export interface IRenderDestroy<T> {
  id: T
  ref?: string
  element?: RenderRenderElement
  onDestroy?: Callback
}

export type RendererRenderArguments<AppId extends AnyAppId> =
  | Array<IRenderRender<AppId> | AppId>
  | AppId
  | void
export type RendererDestroyArguments<AppId extends AnyAppId> =
  | Array<IRenderDestroy<AppId> | AppId>
  | AppId
  | void
export type ResourceType = 'script'
export type ProxyValues = 'render' | 'destroy'

export interface IRepository {
  ids: Set<string>
  props?: { [key: string]: any }
  onRender?: { [key: string]: Callback }
  onDestroy?: { [key: string]: Callback }
  refs?: { [key: string]: Set<string> }
}
export interface IContainerCreator {
  id: string
  loader?: HTMLElement | boolean
  element: RenderRenderElement | undefined
  ref?: string
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
  render(args: RendererRenderArguments<AppId>): void
  destroy(args: RendererDestroyArguments<AppId>): void
}
export interface IInjector {
  fetchDependencies(appIds: string[], cache: IRendererCache): void
}
export interface IHubster<AppId extends AnyAppId> {
  bind(appIds: AppId[]): IHubster<AppId>
  render(args: RendererRenderArguments<AppId>): void
  destroy(args: RendererDestroyArguments<AppId>): void
}
