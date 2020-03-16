import { IFetcher } from '../../utils/types'
import { injectable } from 'inversify'
const { fetch } = window

@injectable()
export class Fetchify implements IFetcher {
  private fetch(url: string): Promise<Response> {
    return fetch(url)
  }
  public getJson<T>(url: string): Promise<T> {
    return this.fetch(url).then(r => r.json())
  }
  public getText(url: string): Promise<string> {
    return this.fetch(url).then(r => r.text())
  }
}
