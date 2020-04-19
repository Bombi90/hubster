import { uuidv4 } from '../utils/uuiv4'
import { Callback } from '../utils/types'
const HUBSTER_PUBLISH_EVENT = '__hubster:publish__'
const HUBSTER_HANDLER_NAME = '__hubster:handler__'

export class Publishify {
  private static state = 'idle'
  private static handlers: Map<string, Set<Callback>> = new Map()
  private static getHandlers(eventName: string): Set<Callback> {
    return Publishify.handlers.get(eventName) || new Set()
  }

  private static setHandlers(eventName: string, handler: Callback): string {
    const metaName = `handler:${uuidv4()}`
    Reflect.defineMetadata(HUBSTER_HANDLER_NAME, metaName, handler)
    const handlers = Publishify.getHandlers(eventName)
    Publishify.handlers.set(eventName, handlers.add(handler))
    return metaName
  }
  static listen(): void {
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
    const handlerName = Publishify.setHandlers(eventName, handler)
    return () => Publishify.unsubscribe(eventName, handlerName)
  }
  static dispatch(eventName: string, payload: any): void {
    dispatchEvent(
      new CustomEvent(HUBSTER_PUBLISH_EVENT, {
        detail: { eventName, payload }
      })
    )
  }
  private static unsubscribe(eventName: string, handlerName: string) {
    const handlers = Publishify.getHandlers(eventName)
    handlers.forEach(callback => {
      console.log('UNSUBSCRIBING ', handlerName)
      console.log(
        'GETTING METADATA ',
        Reflect.getMetadata(HUBSTER_HANDLER_NAME, callback)
      )
      if (Reflect.getMetadata(HUBSTER_HANDLER_NAME, callback) === handlerName) {
        handlers.delete(callback)
      }
    })
  }
}
