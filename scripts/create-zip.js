import { createWriteStream, readFileSync } from 'fs';
import { resolve, join } from 'path';
import archiver from 'archiver';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const manifestPath = resolve(__dirname, '../manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const version = manifest.version;

const outputPath = resolve(__dirname, `../chrome-extension.${version}.zip`);
const distPath = resolve(__dirname, '../dist');

console.log('\x1b[36m%s\x1b[0m', 'Creating zip file...');
console.log('\x1b[32m%s\x1b[0m', `Version: ${version}`);

const output = createWriteStream(outputPath);
const archive = archiver('zip', {
  zlib: { level: 9 } 
});

output.on('close', function() {
  console.log('\x1b[32m%s\x1b[0m', '\n✓ Zip file created successfully!');
  console.log('\x1b[32m%s\x1b[0m', `✓ File: chrome-extension.${version}.zip`);
  console.log('\x1b[32m%s\x1b[0m', `✓ Size: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
  console.log('\x1b[36m%s\x1b[0m', '\nYou can now upload this file to Chrome Web Store.');
});

archive.on('warning', function(err) {
  if (err.code === 'ENOENT') {
    console.warn(err);
  } else {
    throw err;
  }
});

archive.on('error', function(err) {
  throw err;
});

archive.pipe(output);

archive.directory(distPath, false);

archive.finalize();
