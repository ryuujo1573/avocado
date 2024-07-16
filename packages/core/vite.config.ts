import { defineConfig } from "vite"
import dts from "vite-plugin-dts"

export default defineConfig(({ mode }) => {
  return {
    build: {
      lib: {
        entry: {
          index: "src/index.ts",
          qos: "src/qos.ts",
        },
        formats: ["es"],
      },
    },
    plugins: [
      dts({ rollupTypes: true }), // Generate .d.ts files
    ],
  }
})
