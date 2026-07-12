/**
 * Simple build script for the Counsel Chrome Extension.
 * Copies src/ to dist/ with optional watch mode and zip packaging.
 *
 * Usage: node build.js [--watch] [--zip]
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, 'src');
const DIST_DIR = path.join(__dirname, 'dist');

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function build() {
  console.log('[counsel-build] Building extension...');
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
  }
  copyDir(SRC_DIR, path.join(DIST_DIR, 'src'));
  // Copy manifest to dist root
  const manifestSrc = path.join(__dirname, 'manifest.json');
  const manifestDest = path.join(DIST_DIR, 'manifest.json');
  fs.copyFileSync(manifestSrc, manifestDest);
  console.log('[counsel-build] Build complete → dist/');
}

async function createZip() {
  try {
    const archiver = require('archiver');
    const output = fs.createWriteStream(path.join(__dirname, 'counsel-extension.zip'));
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(output);
    archive.directory(DIST_DIR, false);
    await archive.finalize();
    console.log('[counsel-build] Package created → counsel-extension.zip');
  } catch (e) {
    console.error('[counsel-build] archiver not installed. Run: npm install');
  }
}

const args = process.argv.slice(2);

build();

if (args.includes('--zip')) {
  createZip();
}

if (args.includes('--watch')) {
  try {
    const chokidar = require('chokidar');
    console.log('[counsel-build] Watching for changes...');
    chokidar.watch([SRC_DIR, path.join(__dirname, 'manifest.json')], {
      ignoreInitial: true,
    }).on('all', () => {
      console.log('[counsel-build] Changes detected, rebuilding...');
      build();
    });
  } catch (e) {
    console.error('[counsel-build] chokidar not installed. Run: npm install');
  }
}
