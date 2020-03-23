import { Callback } from '../types'
const HUBSTER_PUBLISH_EVENT = '__hubster:publish__'
export class Publishify {
  private static state = 'idle'
  private static handlers: Map<string, Set<Callback>> = new Map()
  private static getHandlers(eventName) {
    return Publishify.handlers.get(eventName) || new Set()
  }
  private static setHandlers(eventName, handler) {
    const handlers = Publishify.getHandlers(eventName)
    return Publishify.handlers.set(eventName, handlers.add(handler))
  }
  static listen() {
    if (Publishify.state === 'idle') {
      addEventListener(HUBSTER_PUBLISH_EVENT, (event: CustomEvent) => {
        const { eventName, payload } = event.detail
        const topicHandlers = Publishify.getHandlers(eventName)
        topicHandlers.forEach(handler => handler(payload))
      })
      Publishify.state = 'listening'
    }
  }
  static register(eventName: string, handler: Callback): Callback {
    // called by the Hubster.on when an action is registered
    // give custom function names to the handlers
    Publishify.setHandlers(eventName, handler)
    return () => Publishify.unsubscribe(eventName, handler.name)
  }
  static dispatch(eventName: string, payload: any) {
    dispatchEvent(
      new CustomEvent(HUBSTER_PUBLISH_EVENT, {
        detail: { eventName, payload }
      })
    )
  }
  private static unsubscribe(eventName: string, handlerName: string) {
    const handlers = Publishify.getHandlers(eventName)
    handlers.forEach(callback => {
      if (callback.name === handlerName) {
        handlers.delete(callback)
      }
    })
  }
}
