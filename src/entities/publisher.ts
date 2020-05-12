import { IPublisher } from '../types'
import { uuidv4 } from '../utils/uuiv4'
import { EPublisherStates } from '../enums'
const HUBSTER_PUBLISH_EVENT = '__hubster:publish__'
const HUBSTER_HANDLER_NAME = '__hubster:handler__'

export const publisher: IPublisher = {
  state: EPublisherStates.IDLE,
  handlers: new Map(),
  getHandlers(eventName) {
    return this.handlers.get(eventName) || new Set()
  },
  setHandlers(eventName, handler) {
    const metaName = `handler:${uuidv4()}`
    Reflect.defineMetadata(HUBSTER_HANDLER_NAME, metaName, handler)
    const handlers = this.getHandlers(eventName)
    this.handlers.set(eventName, handlers.add(handler))
    return metaName
  },
  listen() {
    if (this.state === EPublisherStates.IDLE) {
      addEventListener(HUBSTER_PUBLISH_EVENT, (event: CustomEvent) => {
        const { eventName, payload } = event.detail
        const topicHandlers = this.getHandlers(eventName)
        topicHandlers.forEach(handler => handler(payload))
      })
      this.state = EPublisherStates.LISTENING
    }
  },
  register(eventName, handler) {
    const handlerName = this.setHandlers(eventName, handler)
    return () => this.unsubscribe(eventName, handlerName)
  },
  dispatch(eventName: string, payload: any): void {
    dispatchEvent(
      new CustomEvent(HUBSTER_PUBLISH_EVENT, {
        detail: { eventName, payload }
      })
    )
  },
  unsubscribe(eventName, handlerName) {
    const handlers = this.getHandlers(eventName)
    handlers.forEach(callback => {
      if (Reflect.getMetadata(HUBSTER_HANDLER_NAME, callback) === handlerName) {
        handlers.delete(callback)
      }
    })
  }
}
