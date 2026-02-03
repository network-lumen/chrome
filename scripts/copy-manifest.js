import { copyFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const manifestPath = resolve(__dirname, '../manifest.json');
const distManifestPath = resolve(__dirname, '../dist/manifest.json');

console.log('\x1b[36m%s\x1b[0m', '📋 Copying manifest.json to dist...');

try {
  copyFileSync(manifestPath, distManifestPath);
  console.log('\x1b[32m%s\x1b[0m', '✓ manifest.json copied successfully!');
} catch (error) {
  console.error('\x1b[31m%s\x1b[0m', '✗ Error copying manifest.json:', error.message);
  process.exit(1);
}
