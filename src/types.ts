import { ETransactorStates, ERendererStates, EHubEvents } from './enums'

// for enforcement
export type AnyAppId = string
export type Callback = (...args: any[]) => void | any
export type Props = { [key: string]: any }
export type Loader = HTMLElement | boolean
export type ObjectOf<T> = { [key: string]: T }
export type HubsterEvents = EHubEvents.RENDER | EHubEvents.DESTROY
interface IHubstserEventArguments<T extends string> {
  [EHubEvents.RENDER]: RendererRenderArguments<T>
  [EHubEvents.DESTROY]: RendererDestroyArguments<T>
}
// type ValueOf<T> = T[keyof T]
export type HubsterEventArguments<K extends string, T> = T extends HubsterEvents
  ? IHubstserEventArguments<K>[T]
  : T

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
  event: string,
  callback: Callback
) => void | Callback

/**
 *
 * For Renderer
 */

export type RendererState =
  | ERendererStates.IDLE
  | ERendererStates.FETCHED
  | ERendererStates.FETCHING
  | ERendererStates.RENDERED
  | ERendererStates.DESTROYED
  | ERendererStates.RENDERING
  | ERendererStates.DESTROYNG

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

export type RendererRenderElement =
  | HTMLElement
  | IRenderElementWithSelector
  | IRenderElementWithNode
  | string

export interface IRendererRender<T> {
  id: T
  props?: { [key: string]: any }
  loader?: Loader
  element?: RendererRenderElement
  onRender?: Callback
  ref?: string
}
export interface IRenderDestroy<T> {
  id: T
  ref?: string
  element?: RendererRenderElement
  onDestroy?: Callback
}

export type RendererRenderArguments<AppId extends AnyAppId> =
  | Array<IRendererRender<AppId> | AppId>
  | AppId
  | void
export type RendererDestroyArguments<AppId extends AnyAppId> =
  | Array<IRenderDestroy<AppId> | AppId>
  | AppId
  | void
export type ResourceType = 'script'
export type ProxyValues = HubsterEvents

export interface IRepository {
  ids: Set<string>
  props?: { [key: string]: any }
  onRender?: { [key: string]: Callback }
  onDestroy?: { [key: string]: Callback }
  refs?: { [key: string]: Set<string> }
}
export interface IContainerCreator {
  id: string
  loader?: Loader
  element: RendererRenderElement | undefined
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
  init(configurer: IConfigurer, transactor: ITransactor): void
  create(appIds: string[]): void
  trigger<TEvent extends HubsterEvents>(
    event: TEvent,
    args: HubsterEventArguments<AppId, TEvent>
  ): void
}
export interface IInjector {
  setTransactor(t: ITransactor): void
  fetchDependencies(appIds: string[], cache: IRendererCache): void
}

export interface IHub<AppId extends AnyAppId> {
  bind(appIds: AppId[]): IHub<AppId>
  render(args: RendererRenderArguments<AppId>): void
  destroy(args: RendererDestroyArguments<AppId>): void
}

export interface IPublisher {
  state: 'idle' | 'listening'
  handlers: Map<string, Set<Callback>>
  getHandlers: (eventName: string) => Set<Callback>
  setHandlers: (eventName: string, handler: Callback) => string
  listen: () => void
  register: (eventName: string, payload: any) => void
  dispatch: (eventName: string, payload: any) => void
  unsubscribe: (eventName: string, handlerName: string) => void
}

export interface IHubster {
  createHub<AppId extends string>(config: IConfiguration<AppId>): IHub<AppId>
  on: OnEventFunction
  dispatch: (eventName: string, payload: any) => void
  __publisher: any
}

// For Transactor
export type TransactorState = ETransactorStates.IDLE | ETransactorStates.RUNNING
export type Transaction = () => Promise<void>
export type TransactionQueue = Map<number, Transaction>
export interface ITransactor {
  getTransaction(id: number): Transaction
  setTransaction(value: Transaction): void
}

// For Async
export interface IAsync {
  setMutex<T>(fn: (() => T) | (() => PromiseLike<T>)): Promise<T>
  forEach<T>(
    array: Array<T> | Set<T>,
    callback: (...args: T[]) => Promise<void>
  )
}

type RequestIdleCallbackHandle = any
type RequestIdleCallbackOptions = {
  timeout: number
}
type RequestIdleCallbackDeadline = {
  readonly didTimeout: boolean
  timeRemaining: () => number
}

declare global {
  interface Window {
    requestIdleCallback: (
      callback: (deadline: RequestIdleCallbackDeadline) => void,
      opts?: RequestIdleCallbackOptions
    ) => RequestIdleCallbackHandle
    cancelIdleCallback: (handle: RequestIdleCallbackHandle) => void
    Hubster: IHubster
  }
}

export interface ICreateDomNode {
  element: RendererRenderElement
  appElement: HTMLElement
  loader: Loader
  selector: IAppSelector
  ref: string | undefined
}
