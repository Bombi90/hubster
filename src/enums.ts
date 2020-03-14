export enum EHubsterEvents {
  RENDER = 'render',
  DESTROY = 'destroy'
}

export enum ETypes {
  HUBSTER = 'Hubster',
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
