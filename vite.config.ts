import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // GitHub Pages serves a project site from /<repo-name>/, not /, so every asset URL needs that
  // prefix in a production build. Scoped to `build` only -- the dev server still serves from / so
  // `npm run dev` and its documented --port usage are untouched.
  base: command === 'build' ? '/hot-seat-roguelite/' : '/',
  plugins: [react()],
}))
