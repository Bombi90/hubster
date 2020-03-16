import { Container } from 'inversify'
import {
  IRenderer,
  IConfigurer,
  IFetcher,
  IInjector,
  AnyAppId,
  ITransactor,
  IAsync,
  IContexter
} from '../types'
import { Jsonify } from './configurers/Jsonify'
import { Htmlify } from './renderers/Htmlify'
import { Fetchify } from './fetchers/Fetchify'
import getDecorators from 'inversify-inject-decorators'
import { Dependencify } from './injectors/Dependencify'
import { Transactor } from './Transactor'
import { Async } from './Async'
import { Proxify } from './contexters/Proxify'
import { ETypes } from '../enums'

const hubContainer = new Container()
hubContainer.bind<IRenderer<AnyAppId>>(ETypes.RENDERER).to(Htmlify)
hubContainer.bind<IConfigurer>(ETypes.CONFIGURER).to(Jsonify)
hubContainer.bind<IFetcher>(ETypes.FETCHER).to(Fetchify)
hubContainer.bind<IInjector>(ETypes.INJECTOR).to(Dependencify)
hubContainer.bind<ITransactor>(ETypes.TRANSACTOR).to(Transactor)
hubContainer.bind<IAsync>(ETypes.ASYNC).to(Async)
hubContainer.bind<IContexter>(ETypes.CONTEXTER).to(Proxify)
const { lazyInject } = getDecorators(hubContainer)
export { hubContainer, lazyInject }
