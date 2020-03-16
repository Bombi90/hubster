import { injectable } from 'inversify'
import { IContexter, Context, ProxiedMap } from '../../types'

// TODO: make that nicer
@injectable()
export class Proxify implements IContexter {
  private context
  createContext<K extends object>(): Context<K> {
    this.context = new Map<PropertyKey, K>()
    return new Proxy<ProxiedMap<K>>(this.context, this.contextHandler<K>())
  }
  private contextHandler<K extends object>(): ProxyHandler<ProxiedMap<K>> {
    return {
      get(target, name) {
        if (name in Map.prototype) {
          let ret = Reflect.get(target, name)
          return typeof ret === 'function' ? ret.bind(target) : target[name]
        } else {
          const element = target.get(name)
          if (!element) {
            this.set(target, name, {})
            return undefined
          }
          return element
        }
      },
      set(target, propertyName, propertyValue: K, _receiver) {
        target.set(propertyName, propertyValue)
        return true
      }
    }
  }
}
