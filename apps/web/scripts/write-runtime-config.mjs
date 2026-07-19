import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(__dirname, '../public/env.js');
const apiBaseUrl = process.env.WEB_API_BASE_URL ?? 'http://localhost:3000';

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(
  outputPath,
  `window.__STATSFORGE_CONFIG__ = {\n  apiBaseUrl: ${JSON.stringify(apiBaseUrl)},\n};\n`,
);
