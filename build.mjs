import { build } from 'esbuild'
import { cp, rm } from 'node:fs/promises'

await rm('dist', { recursive: true, force: true })

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/server.cjs',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  sourcemap: true,
  // esbuild reads tsconfig `paths`, so @xmcp/adapter usually resolves on its own.
  // If it doesn't, uncomment:
  // alias: { '@xmcp/adapter': './.xmcp/adapter' },
  external: [], // native modules only, e.g. 'sharp'
})

await cp('src/public', 'dist/public', { recursive: true })
