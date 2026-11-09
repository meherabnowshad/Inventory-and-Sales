#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const targets = [
  {
    example: path.join(rootDir, 'backend', '.env.example'),
    dest: path.join(rootDir, 'backend', '.env'),
    name: 'backend/.env',
  },
  {
    example: path.join(rootDir, 'frontend', '.env.example'),
    dest: path.join(rootDir, 'frontend', '.env'),
    name: 'frontend/.env',
  },
];

console.log('🔧 Initializing environment configuration files...');

for (const target of targets) {
  if (!fs.existsSync(target.example)) {
    console.warn(`⚠️  Warning: ${target.example} not found.`);
    continue;
  }

  if (fs.existsSync(target.dest)) {
    console.log(`ℹ️  ${target.name} already exists. Leaving intact.`);
  } else {
    fs.copyFileSync(target.example, target.dest);
    console.log(`✅ Created ${target.name} from template.`);
  }
}

console.log('✨ Environment setup completed successfully.');
