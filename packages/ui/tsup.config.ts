import { existsSync, readFileSync, writeFileSync } from 'fs';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  // tsup's declaration build sets `baseUrl` itself, which TypeScript 6 reports
  // as deprecated. The option is tsup's, not this package's: tsconfig.json
  // does not use it. Remove this when tsup stops setting it.
  dts: { compilerOptions: { ignoreDeprecations: '6.0' } },
  clean: true,
  sourcemap: true,
  // One file: the "use client" directive below is written into it.
  splitting: false,
  treeshake: true,
  external: ['react', 'react-dom', 'next', 'next-themes'],
  // Every export is client code, so the bundle carries one "use client" directive.
  async onSuccess() {
    const clientFilePath = './dist/index.js';
    if (existsSync(clientFilePath)) {
      const content = readFileSync(clientFilePath, 'utf-8');
      writeFileSync(clientFilePath, `"use client";\n${content}`);
      console.log('Added "use client" directive to dist/index.js');
    }
  },
});
