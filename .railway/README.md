# Railway configuration

`railway.ts` describes the Railway project this repository deploys to: the web
client, the API, their Postgres, the custom domains and the name of every
environment variable.

Railway does not read the file when it deploys. It changes Railway only when it
is applied:

```bash
railway config plan    # preview what would change
railway config apply   # apply it
```

Start with the block marked `CHANGE THESE` at the top of `railway.ts`, then
follow [docs/RAILWAY.md](../docs/RAILWAY.md).

The file has not been planned or applied against a Railway project in this
repository. Read the plan before you apply it.
