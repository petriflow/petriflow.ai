import { build } from 'esbuild'
import { cp, rm } from 'node:fs/promises'

await rm('dist', { recursive: true, force: true })

await build({
  entryPoints: ['src/ts/index.ts'],
  outfile: 'dist/server.cjs',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  sourcemap: true,
  // esbuild reads tsconfig `paths`, so @xmcp/adapter usually resolves on its own.
  // If it doesn't, uncomment:
  // alias: { '@xmcp/adapter': './.xmcp/adapter' },
  external: ['libxmljs2'], // native module; loaded from node_modules at runtime
})

await cp('src/public', 'dist/public', { recursive: true })
await cp('src/groovy', 'dist/groovy', { recursive: true })
