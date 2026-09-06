import esbuild from "esbuild";
import type { BuildOptions } from "esbuild";
import fs from "fs";
import path from "node:path";
import { fileURLToPath } from "node:url";


// Check if --watch flag is passed
const isWatch = process.argv.includes('--watch');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const buildOptions: BuildOptions = {
  entryPoints: ['src/main/preload.ts'],
  bundle: true,
  outfile: 'dist/preload.js',
  platform: 'node',
  target: 'node24',
  format: 'cjs',
  external: ['electron'],
  sourcemap: true,
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
      console.log('👀 Watching preload...');
    } else {
      await esbuild.build(buildOptions);
      copyAssets();
      console.log('✅ Preload built successfully');
    }
  } catch (error) {
    console.error('❌ Preload build failed:', error);
    process.exit(1);
  }
}

build();