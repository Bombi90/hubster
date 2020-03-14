import { injectable } from 'inversify'
import { IAsync } from '../types'

@injectable()
export class Async implements IAsync {
  private mutex = Promise.resolve()

  private lock(): PromiseLike<() => void> {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    let begin: (unlock: () => void) => void = () => {}

    this.mutex = this.mutex.then(() => {
      return new Promise(begin)
    })

    return new Promise(res => {
      begin = res
    })
  }

  public async setMutex<T>(fn: (() => T) | (() => PromiseLike<T>)): Promise<T> {
    const unlock = await this.lock()
    try {
      return await Promise.resolve(fn())
    } finally {
      unlock()
    }
  }
  public async forEach<T>(
    array: Array<T> | Set<T>,
    callback: (...args: any[]) => Promise<void>
  ) {
    for (let el of array) {
      await callback(el)
    }
  }
}
