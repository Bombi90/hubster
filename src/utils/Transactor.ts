import { injectable } from 'inversify'
import {
  Transaction,
  TransactorState,
  TransactionQueue,
  ITransactor
} from '../types'

@injectable()
export class Transactor implements ITransactor {
  private status: TransactorState = 'idle'
  private queue: TransactionQueue = new Map()
  private getNewTransactionKey(): number {
    return Date.now()
  }
  private async commit(): Promise<void> {
    if (this.status === 'idle') {
      this.status = 'running'
      const key = Math.min(...this.queue.keys())
      //   console.log('From transactor TRANSACTION N: ', key)
      const transaction = this.queue.get(key)
      this.queue.delete(key)
      await transaction()
    } else if (this.queue.size > 0) {
      requestAnimationFrame(() => this.commit())
    }
  }
  getTransaction(id: number): Transaction {
    if (this.queue.has(id)) {
      return this.queue.get(id)
    }
    return async () => Promise.resolve()
  }
  setTransaction(transaction: Transaction): void {
    const key = this.getNewTransactionKey()
    this.queue.set(key, transaction)
    this.commit()
  }
}
