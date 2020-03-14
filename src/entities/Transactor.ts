import { injectable } from 'inversify'
import {
  Transaction,
  TransactorState,
  TransactionQueue,
  ITransactor,
  Callback
} from '../types'
import { ETransactorStates } from '../enums'
let requestIdleCallback
if (!('requestIdleCallback' in window)) {
  requestIdleCallback = (cb: Callback, opts: { [key: string]: any }) =>
    setTimeout(cb, opts.timeout || 10)
} else {
  requestIdleCallback = window.requestIdleCallback
}

@injectable()
export class Transactor implements ITransactor {
  private status: TransactorState = ETransactorStates.IDLE
  private queue: TransactionQueue = new Map()
  private getNewTransactionKey(): number {
    const key = Date.now()
    return key
  }
  private async commit(): Promise<void> {
    if (this.status === ETransactorStates.IDLE) {
      this.status = ETransactorStates.RUNNING
      const key = Math.min(...this.queue.keys())
      if (!Number.isInteger(key)) {
        this.status = ETransactorStates.IDLE
        return
      }
      const transaction = this.queue.get(key)
      await transaction()
      this.queue.delete(key)
      this.status = ETransactorStates.IDLE
      requestIdleCallback(
        () => {
          this.commit()
        },
        { timeout: 10 }
      )
    } else if (this.queue.size > 0) {
      requestIdleCallback(
        () => {
          this.commit()
        },
        { timeout: 10 }
      )
    }
  }
  getTransaction(id: number): Transaction {
    if (this.queue.has(id)) {
      return this.queue.get(id)
    }
    return async () => Promise.resolve()
  }
  setTransaction(transaction: Transaction): void {
    window.requestIdleCallback(
      () => {
        const key = this.getNewTransactionKey()
        this.queue.set(key, transaction)
        this.commit()
      },
      { timeout: 10 }
    )
  }
}
