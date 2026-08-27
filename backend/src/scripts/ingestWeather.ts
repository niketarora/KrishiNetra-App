/**
 * Ingest observed weather from Open-Meteo for every district a farm sits in.
 *
 *   npm run ingest:weather
 *   npm run ingest:weather -- --days 30
 *
 * Needs no API key. Districts come from farms that have already resolved one;
 * a farm with no district contributes nothing and stays without weather.
 */
import { getEnv } from '../config/env.js';
import { runWeatherIngestion } from '../ingestion/weather/weatherIngestion.js';

function parseDays(argv: string[]): number | undefined {
  const index = argv.indexOf('--days');
  if (index === -1) return undefined;

  const value = Number(argv[index + 1]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : undefined;
}

async function main(): Promise<void> {
  const env = getEnv();
  const days = parseDays(process.argv.slice(2));

  console.log(`\nIngesting observed weather into ${env.SUPABASE_URL}\n`);

  const report = await runWeatherIngestion(days ? { days } : {});

  console.log(`  districts ${report.districts}`);
  console.log(`  written   ${report.inserted}`);

  if (report.skipped.length > 0) {
    console.log('  skipped:');
    for (const { reason, count } of report.skipped) {
      console.log(`    ${String(count).padStart(5)}  ${reason}`);
    }
  }

  if (report.failures.length > 0) {
    console.log('  failed:');
    for (const { district, reason } of report.failures) {
      console.log(`    ${district}: ${reason}`);
    }
  }

  if (report.districts === 0) {
    console.log(
      '\nNo farm has a resolved district yet. Save a field boundary first —' +
        '\nthe API reverse-geocodes the centroid when the farm is created.',
    );
  }

  console.log('');
}

main().catch((error: unknown) => {
  console.error(`\n${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
