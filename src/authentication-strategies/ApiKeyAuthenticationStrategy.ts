import { HttpErrors, Request } from '@loopback/rest';
import { AuthenticationStrategy } from '@loopback/authentication';
import { UserProfile, securityId } from '@loopback/security';

export class ApiKeyAuthenticationStrategy implements AuthenticationStrategy {
  name = 'team-vegan-api-key';

  constructor(
  ) { }

  async authenticate(request: Request): Promise<UserProfile | undefined> {
    const apiKey: string = this.extractCredentials(request);

    // Check against process.env.X_API_KEY
    if (apiKey !== process.env.X_API_KEY) {
      throw new HttpErrors.Unauthorized(`x-api-key invalid`);
    }

    const userProfile: UserProfile = Object.assign(
      { [securityId]: '', name: '' },
      {
        [securityId]: apiKey,
        name: 'x-api-key',
        id: apiKey,
        roles: '',
      },
    );

    return userProfile;
  }

  extractCredentials(request: Request): string {
    if (!request.headers['x-api-key']) {
      throw new HttpErrors.Unauthorized(`api key header not found.`);
    }

    // for example: Bearer xxx.yyy.zzz
    const authHeaderValue = request.headers['x-api-key'] as string;

    return authHeaderValue;
  }
}
