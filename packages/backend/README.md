# @app/backend

The shared foundation the API boots from. `apps/api` is its only consumer.

What the API uses:

| Export | What it does |
|---|---|
| `Backend.create(app, PrismaClient, { configService })` | Connects Prisma and installs JSON parsing, helmet, CORS, the global rate limit, request ids, request logging, Clerk auth and user provisioning. `backend.setupErrorHandling()` adds the 404 and error handlers and must run after every route is mounted. |
| `getAuthenticatedUser(req)` | The signed-in user of a request. Throws `AuthenticationError` (401) when there is none. Controllers call it first and scope every query by the `userId` it returns. |
| `AUTH_EXEMPT_PATHS` | Paths answered without Clerk (the health checks). |
| `AppConfigService`, `createDefaultAppConfig` | The config object `Backend` reads. |
| `createErrorHandler`, `createNotFoundHandler` | The error and 404 handlers, also mounted by the integration tests. |

Provisioning creates the user's row on their first request with a valid
session (`src/auth/auto-provision.ts`) through `UserModel`, which is built on
`BaseModel` and `DatabaseService`. Those, the logger (Winston, with an optional
Logtail transport) and the request-id middleware are the rest of the package.

`src/index-exports.test.ts` pins the exact list of exported names. Adding or
removing an export means updating that list in the same change.

```bash
pnpm --filter @app/backend build   # CommonJS and ES module output in dist/
pnpm --filter @app/backend test
```

Lint reports this package's remaining uses of `any` as warnings. See
`eslint.config.mjs`.
