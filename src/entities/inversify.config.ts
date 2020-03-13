import { Container } from 'inversify'
import {
  IRenderer,
  IConfigurer,
  IFetcher,
  IInjector,
  AnyAppId,
  ITransactor,
  IAsync
} from '../types'
import { Jsonify } from './configurers/Jsonify'
import { Htmlify } from './renderers/Htmlify'
import { Fetchify } from './fetchers/Fetchify'
import getDecorators from 'inversify-inject-decorators'
import { Proxify } from './injectors/Proxify'
import { Transactor } from '../utils/Transactor'
import { Async } from '../utils/Async'
import { ETypes } from '../enums'

const hubContainer = new Container()
hubContainer.bind<IRenderer<AnyAppId>>(ETypes.RENDERER).to(Htmlify)
hubContainer.bind<IConfigurer>(ETypes.CONFIGURER).to(Jsonify)
hubContainer.bind<IFetcher>(ETypes.FETCHER).to(Fetchify)
hubContainer.bind<IInjector>(ETypes.INJECTOR).to(Proxify)
hubContainer.bind<ITransactor>(ETypes.TRANSACTOR).to(Transactor)
hubContainer.bind<IAsync>(ETypes.ASYNC).to(Async)
const { lazyInject } = getDecorators(hubContainer)
export { hubContainer, lazyInject }
