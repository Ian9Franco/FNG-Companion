import { build } from 'esbuild'
import { cpSync, mkdirSync, rmSync } from 'node:fs'
rmSync('dist', { recursive: true, force: true })
mkdirSync('dist', { recursive: true })
await build({
  entryPoints: { background: 'src/background.ts', panel: 'src/panel/main.tsx' },
  outdir: 'dist',
  platform: 'browser',
  format: 'iife',
  bundle: true,
  target: ['chrome116'],
  minify: false,
  sourcemap: true,
  logLevel: 'info',
})
cpSync('public/manifest.json', 'dist/manifest.json')
cpSync('public/panel.html', 'dist/panel.html')
