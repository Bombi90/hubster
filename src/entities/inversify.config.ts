import { Container } from 'inversify'
import {
  IRenderer,
  IConfigurer,
  TYPES,
  IFetcher,
  IInjector,
  AnyAppId,
  ITransactor
} from '../types'
import { Jsonify } from './configurers/Jsonify'
import { Htmlify } from './renderers/Htmlify'
import { Fetchify } from './fetchers/Fetchify'
import getDecorators from 'inversify-inject-decorators'
import { Proxify } from './injectors/Proxify'
import { Transactor } from '../utils/Transactor'

const hubContainer = new Container()
hubContainer.bind<IRenderer<AnyAppId>>(TYPES.IRenderer).to(Htmlify)
hubContainer.bind<IConfigurer>(TYPES.IConfigurer).to(Jsonify)
hubContainer.bind<IFetcher>(TYPES.IFetcher).to(Fetchify)
hubContainer.bind<IInjector>(TYPES.IInjector).to(Proxify)
hubContainer.bind<ITransactor>(TYPES.ITransactor).to(Transactor)
const { lazyInject } = getDecorators(hubContainer)
export { hubContainer, lazyInject }
