import { defineConfig } from 'drizzle-kit';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Automatically load DATABASE_URL from .env.local if not already in process.env
if (!process.env.DATABASE_URL) {
  const envLocalPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envLocalPath)) {
    const content = fs.readFileSync(envLocalPath, 'utf-8');
    for (const line of content.split('\n')) {
      const match = line.match(/^\s*DATABASE_URL\s*=\s*(.*)?\s*$/);
      if (match && match[1]) {
        process.env.DATABASE_URL = match[1].trim().replace(/^['"]|['"]$/g, '');
        break;
      }
    }
  }
}

export default defineConfig({
  schema: './src/shared/db/schema.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/fishing_spot',
  },
});
