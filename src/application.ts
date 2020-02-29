import { BootMixin } from '@loopback/boot';
import { ApplicationConfig, BindingKey } from '@loopback/core';
import { RepositoryMixin } from '@loopback/repository';
import { registerAuthenticationStrategy, AuthenticationComponent } from '@loopback/authentication';
import {
  RestExplorerBindings,
  RestExplorerComponent,
} from '@loopback/rest-explorer';
import { RestApplication } from '@loopback/rest';
import { ServiceMixin } from '@loopback/service-proxy';
import path from 'path';
import { JWTAuthenticationStrategy } from './authentication-strategies/JWTAuthenticationStrategy';
import { TokenServiceBindings, TokenServiceConstants } from './keys';
import { JWTService } from './services/jwt-service';
import { SECURITY_SCHEME_SPEC } from './utils/security-spec';
import { MyAuthenticationSequence } from './sequence';
import { ApiKeyAuthenticationStrategy } from './authentication-strategies/ApiKeyAuthenticationStrategy';

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

    /*
           This is a workaround until an extension point is introduced
           allowing extensions to contribute to the OpenAPI specification
           dynamically.
        */
    this.api({
      openapi: '3.0.0',
      info: { title: pkg.name, version: pkg.version },
      paths: {},
      components: { securitySchemes: SECURITY_SCHEME_SPEC },
      servers: [{ url: '/' }],
    });


    this.setUpBindings();

    // Bind authentication component related elements
    this.component(AuthenticationComponent);

    // Bind authentication component
    registerAuthenticationStrategy(this, JWTAuthenticationStrategy);
    registerAuthenticationStrategy(this, ApiKeyAuthenticationStrategy);

    // Set up the custom sequence
    this.sequence(MyAuthenticationSequence);

    // Set up default home page
    this.static('/', path.join(__dirname, '../public'));

    // Customize @loopback/rest-explorer configuration here
    this.bind(RestExplorerBindings.CONFIG).to({
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

    this.bind(TokenServiceBindings.TOKEN_SECRET).to(
      TokenServiceConstants.TOKEN_SECRET_VALUE,
    );

    this.bind(TokenServiceBindings.TOKEN_EXPIRES_IN).to(
      TokenServiceConstants.TOKEN_EXPIRES_IN_VALUE,
    );

    this.bind(TokenServiceBindings.TOKEN_SERVICE).toClass(JWTService);
  }
}
