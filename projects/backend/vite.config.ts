import { defineConfig, loadEnv } from "vite"

export default defineConfig({
  test: {
    globals: true,
    env: loadEnv("development", ".", ""),
  },
})
