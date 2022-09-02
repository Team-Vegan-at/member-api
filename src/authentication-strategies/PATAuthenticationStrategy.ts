import {AuthenticationStrategy} from '@loopback/authentication';
import {HttpErrors, RedirectRoute, Request} from '@loopback/rest';
import {securityId, UserProfile} from '@loopback/security';
import {PatService} from '../services/pat.service';


export class PATAuthenticationStrategy implements AuthenticationStrategy {
  name = 'team-vegan-pat';

  constructor() {}

  async authenticate(request: Request): Promise<UserProfile | RedirectRoute | undefined> {
    const pat: string = this.extractCredentials(request);
    const valid = await new PatService().validatePAT(pat)
      .then(() => { return true })
      .catch(() => { return false });

    if (!valid) {
      throw new HttpErrors.Unauthorized(`x-pat invalid`);
    }

    const userProfile: UserProfile = Object.assign(
      {[securityId]: '', name: ''},
      {
        [securityId]: pat,
        name: 'x-pat',
        id: pat,
        roles: '',
      },
    );

    return userProfile;
  }

  extractCredentials(request: Request): string {
    if (!request.headers['x-pat']) {
      throw new HttpErrors.Unauthorized(`pat key header not found.`);
    }

    const authHeaderValue = request.headers['x-pat'] as string;

    return authHeaderValue;
  }
}
