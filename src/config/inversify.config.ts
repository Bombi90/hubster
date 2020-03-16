import { Container } from 'inversify'
import getDecorators from 'inversify-inject-decorators'
import {
  IRenderer,
  IConfigurer,
  IFetcher,
  IInjector,
  AnyAppId,
  ITransactor,
  IAsync,
  IContexter
} from '../utils/types'
import { Jsonify } from '../entities/configurers/Jsonify'
import { Htmlify } from '../entities/renderers/Htmlify'
import { Fetchify } from '../entities/fetchers/Fetchify'
import { Dependencify } from '../entities/injectors/Dependencify'
import { Transactor } from '../entities/Transactor'
import { Async } from '../entities/Async'
import { Proxify } from '../entities/contexters/Proxify'
import { ETypes } from '../utils/enums'

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
