import esbuild from "esbuild";
import type { BuildOptions } from "esbuild";
import fs from "fs";
import path from "node:path";
import { fileURLToPath } from "node:url";


// Check if --watch flag is passed
const isWatch = process.argv.includes('--watch');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const buildOptions: BuildOptions = {
  entryPoints: { preload: 'src/main/preload.ts', 'main/main': 'src/main/main.ts' },
  bundle: true,
  outdir: 'dist',
  platform: 'node',
  target: 'node24',
  format: 'cjs',
  external: ['electron'],
  sourcemap: true,
  // Explicit, since files in src/shared would otherwise pick up the root tsconfig, which has no paths
  alias: {
    '@main': path.join(__dirname, 'src/main'),
    '@shared': path.join(__dirname, 'src/shared'),
    '@assets': path.join(__dirname, 'src/assets'),
  },
};

function copyAssets() {
  const srcAssets = path.join(__dirname, 'src', 'assets');
  const distAssets = path.join(__dirname, 'dist', 'assets');

  // Check if source assets folder exists
  if (fs.existsSync(srcAssets)) {
    fs.cpSync(srcAssets, distAssets, { recursive: true });
    console.log('📦 Assets copied');
  }
}

async function build() {
  try {
    if (isWatch) {
      const ctx = await esbuild.context(buildOptions);
      await ctx.watch();
      copyAssets(); // Copy once on initial build
      console.log('👀 Watching main and preload...');
    } else {
      await esbuild.build(buildOptions);
      copyAssets();
      console.log('✅ Main and preload built successfully');
    }
  } catch (error) {
    console.error('❌ Main and preload build failed:', error);
    process.exit(1);
  }
}

build();