export enum EHubEvents {
  RENDER = 'render',
  DESTROY = 'destroy'
}

export enum ETypes {
  CONFIGURER = 'Configurer',
  RENDERER = 'Renderer',
  FETCHER = 'Fetcher',
  INJECTOR = 'Injector',
  ASYNC = 'Async',
  TRANSACTOR = 'Transactor'
}

export enum ETransactorStates {
  IDLE = 'idle',
  RUNNING = 'running'
}

export enum ERendererStates {
  IDLE = 'idle',
  FETCHED = 'fetched',
  FETCHING = 'fetching',
  RENDERED = 'rendered',
  DESTROYED = 'destroyed',
  RENDERING = 'rendering',
  DESTROYNG = 'destroying'
}
