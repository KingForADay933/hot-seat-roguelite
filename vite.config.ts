import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
/**
 * Where a build expects to be served from, which differs per destination:
 *
 * - GitHub Pages serves a project site from /<repo-name>/, so every asset URL needs that prefix.
 * - itch.io unzips an HTML build to a path nobody can predict and serves it inside an iframe, so
 *   any absolute prefix (including Pages') would 404 every asset. Relative URLs are the only thing
 *   that survives, which is what `--mode itch` selects.
 * - The dev server serves from /, so `npm run dev` and its documented --port usage are untouched.
 */
function basePath(command: string, mode: string): string {
  if (command !== 'build') return '/'
  return mode === 'itch' ? './' : '/hot-seat-roguelite/'
}

export default defineConfig(({ command, mode }) => ({
  base: basePath(command, mode),
  plugins: [react()],
}))
