import { adminClient } from '../config/supabase.js';

async function checkDatabase() {
  const admin = adminClient();
  const tables = [
    'profiles',
    'farms',
    'crops',
    'farm_crops',
    'mandis',
    'market_prices',
    'msp',
    'weather',
    'government_schemes',
  ];

  console.log('=== SUPABASE TABLES CHECK ===');
  for (const table of tables) {
    try {
      const { data, count, error } = await admin
        .from(table)
        .select('*', { count: 'exact' })
        .limit(1);

      if (error) {
        console.log(`[MISSING/ERROR] ${table}: ${error.message} (${error.code})`);
      } else {
        const columns = data && data[0] ? Object.keys(data[0]).join(', ') : '(empty table)';
        console.log(`[EXISTS] ${table} | Rows: ${count} | Columns: ${columns}`);
      }
    } catch (err: any) {
      console.log(`[FAILED] ${table}: ${err.message}`);
    }
  }

  console.log('\n=== SUPABASE STORAGE BUCKETS CHECK ===');
  try {
    const { data: buckets, error: bError } = await admin.storage.listBuckets();
    if (bError) {
      console.log('Bucket check error:', bError.message);
    } else {
      console.log('Existing buckets:');
      for (const b of buckets) {
        console.log(`- ${b.id} (public: ${b.public})`);
      }
    }
  } catch (err: any) {
    console.log('Storage exception:', err.message);
  }
}

checkDatabase()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
