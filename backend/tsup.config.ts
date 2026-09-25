import { defineConfig } from "tsup";

/**
 * One bundled ESM file per entry. The workspace contract package is inlined
 * (it ships TypeScript source); every npm dependency stays external and is
 * installed in the image with `npm ci --omit=dev`.
 */
export default defineConfig({
  entry: { server: "src/server.ts", seed: "prisma/seed/index.ts" },
  format: ["esm"],
  platform: "node",
  target: "node20",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  splitting: true,
  noExternal: [/^@chs\//],
  banner: { js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" },
});
