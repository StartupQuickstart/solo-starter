import { AUTH_EXEMPT_PATHS } from '@app/backend';
import { Router } from 'express';

/** Identifies which service answered, for probes that watch more than one. */
export const HEALTH_SERVICE_NAME = 'api';

/**
 * Public health check, used by the host's deploy checks, load balancers and
 * uptime probes.
 *
 * Served on every auth-exempt path: Clerk's middleware is skipped for those
 * paths, so one without a route would fall through to `requireAuth()` and
 * throw instead of answering.
 */
export function createHealthRouter(): Router {
  const router = Router();
  router.get([...AUTH_EXEMPT_PATHS], (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: HEALTH_SERVICE_NAME,
    });
  });
  return router;
}
