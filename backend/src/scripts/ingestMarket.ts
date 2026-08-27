/**
 * Ingest real mandi prices from data.gov.in.
 *
 *   npm run ingest:market
 *   npm run ingest:market -- --state Rajasthan --commodity Wheat
 *
 * Prints what it wrote and, just as importantly, what it refused to write and
 * why. A silent ingester is how fabricated data gets in.
 */
import { getEnv } from '../config/env.js';
import { runMarketIngestion } from '../ingestion/market/marketIngestion.js';
import type { MarketFetchFilters } from '../ingestion/market/marketSource.js';

function parseArgs(argv: string[]): MarketFetchFilters {
  const filters: MarketFetchFilters = {};

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) continue;

    if (flag === '--state') filters.state = value;
    if (flag === '--district') filters.district = value;
    if (flag === '--commodity') filters.commodity = value;
  }

  return filters;
}

async function main(): Promise<void> {
  const env = getEnv();
  // Default to the geography the reference data actually covers. Ingesting the
  // whole country would just produce a long list of unmapped mandis.
  const filters = { state: 'Rajasthan', commodity: 'Wheat', ...parseArgs(process.argv.slice(2)) };

  console.log(`\nIngesting market prices into ${env.SUPABASE_URL}`);
  console.log(`Filters: ${JSON.stringify(filters)}\n`);

  const report = await runMarketIngestion(filters);

  console.log(`  fetched   ${report.fetched}`);
  console.log(`  written   ${report.inserted}`);

  if (report.skipped.length > 0) {
    console.log('  skipped:');
    for (const { reason, count } of report.skipped) {
      console.log(`    ${String(count).padStart(5)}  ${reason}`);
    }
  }

  if (report.inserted === 0) {
    console.log(
      '\nNothing was written. The API keeps reporting market data as not connected,' +
        '\nwhich is correct — it does not invent prices to fill the gap.',
    );
  }

  console.log('');
}

main().catch((error: unknown) => {
  console.error(`\n${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
