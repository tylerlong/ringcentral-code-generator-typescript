import { defineConfig } from "tsup";

export default defineConfig({
  clean: true,
  dts: false,
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  outDir: "build",
  sourcemap: true,
  splitting: false,
  target: "node18",
});
