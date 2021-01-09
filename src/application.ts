import {
  AuthenticationComponent, registerAuthenticationStrategy
} from '@loopback/authentication';
import {BootMixin} from '@loopback/boot';
import {ApplicationConfig, BindingKey} from '@loopback/core';
import {RepositoryMixin} from '@loopback/repository';
import {RestApplication} from '@loopback/rest';
import {
  RestExplorerBindings,
  RestExplorerComponent
} from '@loopback/rest-explorer';
import {ServiceMixin} from '@loopback/service-proxy';
import path from 'path';
import {ApiKeyAuthenticationStrategy} from './authentication-strategies/ApiKeyAuthenticationStrategy';
import {JWTAuthenticationStrategy} from './authentication-strategies/JWTAuthenticationStrategy';
import {PATAuthenticationStrategy} from './authentication-strategies/PATAuthenticationStrategy';
import {TokenServiceBindings, TokenServiceConstants} from './keys';
import {MySequence} from './sequence';
import {JWTService} from './services/jwt-service';

/**
 * Information from package.json
 */
export interface PackageInfo {
  name: string;
  version: string;
  description: string;
}
export const PackageKey = BindingKey.create<PackageInfo>('application.package');
const pkg: PackageInfo = require('../package.json');

export class MemberApiApplication extends BootMixin(
  ServiceMixin(RepositoryMixin(RestApplication)),
) {
  constructor(options: ApplicationConfig = {}) {
    super(options);

    this.setUpBindings();

    // Bind authentication component related elements
    this.component(AuthenticationComponent);

    // Bind authentication component
    registerAuthenticationStrategy(this, JWTAuthenticationStrategy);
    registerAuthenticationStrategy(this, ApiKeyAuthenticationStrategy);
    registerAuthenticationStrategy(this, PATAuthenticationStrategy);

    // Set up the custom sequence
    this.sequence(MySequence);

    // Set up membership portal
    this.static('/', path.join(__dirname, '../public/membership'));
    // Set up loopback site
    this.static('/lb', path.join(__dirname, '../public/lb.html'));

    // Set up Mollie checkout
    this.static('/checkout-qs', path.join(__dirname, '../public/mollie-checkout-qs.html'));
    this.static('/checkout', path.join(__dirname, '../public/mollie-checkout.html'));


    // Customize @loopback/rest-explorer configuration here
    this.configure(RestExplorerBindings.COMPONENT).to({
      path: '/explorer',
    });
    this.component(RestExplorerComponent);

    this.projectRoot = __dirname;
    // Customize @loopback/boot Booter Conventions here
    this.bootOptions = {
      controllers: {
        // Customize ControllerBooter Conventions here
        dirs: ['controllers'],
        extensions: ['.controller.js'],
        nested: true,
      },
    };
  }

  setUpBindings(): void {
    // Bind package.json to the application context
    this.bind(PackageKey).to(pkg);

    this.bind(TokenServiceBindings.JWT_SECRET).to(
      TokenServiceConstants.JWT_SECRET_VALUE,
    );

    this.bind(TokenServiceBindings.JWT_EXPIRES_IN).to(
      TokenServiceConstants.JWT_EXPIRES_IN_VALUE,
    );

    this.bind(TokenServiceBindings.TOKEN_SERVICE).toClass(JWTService);
  }
}
