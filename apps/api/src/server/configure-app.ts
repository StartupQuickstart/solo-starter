import type { Express } from 'express';

import type { ApiConfig } from '@/config/app.config';

/**
 * Express settings that must be in place before any middleware runs.
 *
 * `trust proxy` decides what `req.ip` is. Behind a load balancer the socket
 * address is the balancer's, so without it every client shares one address
 * (and one rate-limit bucket). Trusting more hops than really exist is worse:
 * the client could then choose its own address by sending X-Forwarded-For.
 * The value is the number of proxies in front of the process, from
 * `TRUST_PROXY`.
 *
 * @param app - The Express application, before middleware is mounted.
 * @param config - The parsed API configuration.
 */
export function configureApp(app: Express, config: Pick<ApiConfig, 'trustProxyHops'>): void {
  app.set('trust proxy', config.trustProxyHops);

  // Express sends ETags on JSON responses, so a repeat request answers 304
  // with an empty body. The web client does its own caching (TanStack Query),
  // so conditional responses buy nothing here.
  app.set('etag', false);
}
