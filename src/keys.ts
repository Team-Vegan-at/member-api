// Copyright IBM Corp. 2019,2020. All Rights Reserved.
// Node module: loopback4-example-shopping
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {TokenService} from '@loopback/authentication';
import {BindingKey} from '@loopback/context';

export namespace TokenServiceConstants {
  export const JWT_SECRET_VALUE = 'myjwts3cr3t';
  export const JWT_EXPIRES_IN_VALUE = '600';
}

export namespace TokenServiceBindings {
  export const JWT_SECRET = BindingKey.create<string>(
    'authentication.jwt.secret',
  );
  export const JWT_EXPIRES_IN = BindingKey.create<string>(
    'authentication.jwt.expires.in.seconds',
  );
  export const TOKEN_SERVICE = BindingKey.create<TokenService>(
    'services.authentication.jwt.tokenservice',
  );
}
