/**
 * Ingest the real 3,235-row government schemes dataset into Supabase.
 *
 *   npm run ingest:schemes
 *   npm run ingest:schemes -- --file /path/to/schemes.json
 */
import { getEnv } from '../config/env.js';
import { runSchemesIngestion } from '../ingestion/schemes/schemesIngestion.js';

function parseFileArg(argv: string[]): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    const next = argv[i + 1];
    if (argv[i] === '--file' && next && !next.startsWith('--')) {
      return next;
    }
  }
  return undefined;
}

async function main(): Promise<void> {
  const env = getEnv();
  const customFile = parseFileArg(process.argv.slice(2));

  console.log(`\nIngesting government schemes into ${env.SUPABASE_URL}`);
  if (customFile) console.log(`File: ${customFile}`);

  try {
    const report = await runSchemesIngestion(customFile);

    console.log(`\n  total read   ${report.totalRead}`);
    console.log(`  written      ${report.written}`);

    if (report.skipped.length > 0) {
      console.log('  skipped:');
      for (const { reason, count } of report.skipped) {
        console.log(`    ${String(count).padStart(5)}  ${reason}`);
      }
    } else {
      console.log(`  skipped      0`);
    }

    console.log('\nSchemes ingestion completed successfully.\n');
  } catch (error) {
    console.error('\nIngestion failed:', error);
    process.exit(1);
  }
}

void main();
