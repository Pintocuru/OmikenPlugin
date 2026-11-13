// vitest.config.ts
import { defineConfig } from 'vitest/config'
// import path from 'path'
// import tsconfigPaths from 'vite-tsconfig-paths'
import { alias } from './vite.config'

export default defineConfig({
  //  plugins: [ tsconfigPaths() ],
  test: { globals: true, },
  resolve: { alias: alias, },
})
