/**
 * Creates a demo farmer for development and demos.
 *
 *   npm run seed:demo
 *
 * This is NOT reference data and deliberately does not live in
 * supabase/migrations/. Those files are the real schema and genuinely sourced
 * reference rows; this one invents a person, so it stays a script you have to
 * run on purpose, and it refuses to run against production.
 *
 * What it is safe to fabricate here, and what is not:
 *
 *   fabricated   the farmer, their field, and what they planted — a test
 *                account, clearly labelled as one
 *   resolved     their district, by the same gazetteer lookup the API uses when
 *                a boundary is saved, so weather can be ingested for them
 *   NOT touched  market_prices and weather stay empty. Inventing a price a
 *                farmer might act on is exactly what IMPLEMENTATION.md rule 13
 *                forbids, and a demo is not an exception.
 *
 * Re-running resets the demo farmer's field and crops to a known state, so it
 * is safe to run repeatedly while developing.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import { getEnv } from '../config/env.js';
import { adminClient } from '../config/supabase.js';
import { reverseGeocode } from '../ingestion/geocode/reverseGeocode.js';
import { areaFromBoundary, centroidFromBoundary, type BoundaryGeoJSON } from '../utils/geo.js';

// ---------------------------------------------------------------------------
// The demo farmer
// ---------------------------------------------------------------------------

export const DEMO_FARMER = {
  // example.com is reserved by RFC 2606, so this address can never reach a real
  // person's inbox no matter which environment the script is pointed at.
  email: 'demo.farmer@example.com',
  password: 'DemoFarmer#2026',
  fullName: 'Ramesh Kumar Meena',
  // Placeholder pattern, not an allocated subscriber number.
  phone: '+919999900001',
  // 'hi' exercises the Devanagari font and the Hindi locale end to end.
  language: 'en',
} as const;

/**
 * A plot on the outskirts of Alwar, Rajasthan — the district of one of the
 * seeded mandis, so the demo farmer sits in the same geography as the market
 * data Phase 3 will connect. Roughly 110 m by 92 m, deliberately not a perfect
 * rectangle so it looks like something a farmer drew by hand.
 */
const DEMO_BOUNDARY: BoundaryGeoJSON = {
  type: 'Polygon',
  coordinates: [
    [
      [76.63, 27.55],
      [76.631115, 27.55006],
      [76.63116, 27.550889],
      [76.63004, 27.550829],
      [76.63, 27.55],
    ],
  ],
};

const DEMO_FARM_NAME = 'North Field';

// ---------------------------------------------------------------------------
// Rabi season dates, derived from today so the demo never reads as stale
// ---------------------------------------------------------------------------

type Season = { sownOn: string; harvestOn: string };

/**
 * Wheat in Rajasthan is a rabi crop: sown around mid-November, harvested in
 * early April. Returns the most recently completed season and the next one, so
 * the demo shows both a finished crop and a planned one whenever it is run.
 */
export function rabiSeasons(today: Date): { lastCompleted: Season; upcoming: Season } {
  const year = today.getUTCFullYear();
  // Before May the April harvest of the season sown in Nov(year-1) has only
  // just happened or is still under way, so the last *completed* season is a
  // year further back.
  const lastSownYear = today.getUTCMonth() >= 4 ? year - 1 : year - 2;
  // Once November has started, the coming season is next year's.
  const nextSownYear = today.getUTCMonth() >= 10 ? year + 1 : year;

  return {
    lastCompleted: {
      sownOn: `${lastSownYear}-11-15`,
      harvestOn: `${lastSownYear + 1}-04-05`,
    },
    upcoming: {
      sownOn: `${nextSownYear}-11-15`,
      harvestOn: `${nextSownYear + 1}-04-05`,
    },
  };
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

/**
 * Create the auth user, or find them if they already exist. Passwords are
 * handled entirely by Supabase Auth — nothing here writes one anywhere else.
 */
async function ensureAuthUser(db: SupabaseClient): Promise<string> {
  const { data, error } = await db.auth.admin.createUser({
    email: DEMO_FARMER.email,
    password: DEMO_FARMER.password,
    // Skips the confirmation email, so the account can sign in immediately.
    email_confirm: true,
    user_metadata: {
      full_name: DEMO_FARMER.fullName,
      language: DEMO_FARMER.language,
    },
  });

  if (!error && data.user) {
    console.log(`  created auth user  ${data.user.id}`);
    return data.user.id;
  }

  const alreadyExists =
    error?.message?.toLowerCase().includes('already') || error?.code === 'email_exists';

  if (!alreadyExists) {
    throw new Error(`Could not create the demo auth user: ${error?.message ?? 'unknown error'}`);
  }

  const existing = await findUserByEmail(db, DEMO_FARMER.email);
  if (!existing) {
    throw new Error(
      `Supabase says ${DEMO_FARMER.email} exists but it could not be found. ` +
        'Delete it in Authentication > Users and run this again.',
    );
  }

  // Reset the password so the documented credentials always work, even if the
  // account was created by an earlier run with a different one.
  const { error: updateError } = await db.auth.admin.updateUserById(existing, {
    password: DEMO_FARMER.password,
    user_metadata: {
      full_name: DEMO_FARMER.fullName,
      language: DEMO_FARMER.language,
    },
  });
  if (updateError) throw new Error(`Could not reset the demo password: ${updateError.message}`);

  console.log(`  reused auth user   ${existing}`);
  return existing;
}

/** The admin API has no lookup-by-email, so page through until we find them. */
async function findUserByEmail(db: SupabaseClient, email: string): Promise<string | null> {
  const target = email.toLowerCase();

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`Could not list users: ${error.message}`);
    if (data.users.length === 0) return null;

    const match = data.users.find((user) => user.email?.toLowerCase() === target);
    if (match) return match.id;
  }

  return null;
}

/**
 * The handle_new_user trigger already created the profile from the metadata
 * above. This fills in the phone, which the trigger does not carry.
 */
async function upsertProfile(db: SupabaseClient, userId: string): Promise<void> {
  const { error } = await db.from('profiles').upsert(
    {
      id: userId,
      full_name: DEMO_FARMER.fullName,
      phone: DEMO_FARMER.phone,
      language: DEMO_FARMER.language,
    },
    { onConflict: 'id' },
  );

  if (error) throw new Error(`Could not write the demo profile: ${error.message}`);
  console.log(`  profile            ${DEMO_FARMER.fullName}`);
}

/**
 * Replace whatever the demo farmer had with one known field. Areas are derived
 * here by the same functions the API uses, so the stored numbers are the real
 * geodesic measurements of the polygon above rather than figures typed in.
 */
async function replaceFarm(db: SupabaseClient, userId: string): Promise<string> {
  // farm_crops cascades from farms, so this clears both.
  const { error: deleteError } = await db.from('farms').delete().eq('user_id', userId);
  if (deleteError) throw new Error(`Could not clear the demo farm: ${deleteError.message}`);

  const area = areaFromBoundary(DEMO_BOUNDARY);
  const centre = centroidFromBoundary(DEMO_BOUNDARY);

  // The API reverse-geocodes a farm when a boundary is saved through it. This
  // script writes the row directly, so it has to do the same lookup itself —
  // otherwise the demo farm has no district and the weather tile stays empty,
  // which is a confusing way to start a demonstration.
  const location = await reverseGeocode(centre.latitude, centre.longitude);

  const { data, error } = await db
    .from('farms')
    .insert({
      user_id: userId,
      name: DEMO_FARM_NAME,
      boundary: DEMO_BOUNDARY,
      area_sq_meters: area.squareMeters,
      area_acres: area.acres,
      area_hectares: area.hectares,
      centroid_lat: centre.latitude,
      centroid_lng: centre.longitude,
      district: location?.district ?? null,
      state: location?.state ?? null,
      location_source: location?.source ?? null,
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`Could not create the demo farm: ${error?.message ?? 'no row returned'}`);
  }

  console.log(
    `  farm               ${DEMO_FARM_NAME} — ${area.acres.toFixed(2)} acres ` +
      `(${area.hectares.toFixed(2)} ha, ${Math.round(area.squareMeters)} m2)`,
  );

  if (location) {
    console.log(`  location           ${location.district}, ${location.state}`);
  } else {
    console.warn('  location           NOT RESOLVED - the weather tile will stay empty.');
    console.warn('                     Re-run when online; nothing here guesses a district.');
  }

  return data.id as string;
}

/** One finished season and one planned, both wheat. */
async function seedFarmCrops(db: SupabaseClient, userId: string, farmId: string): Promise<void> {
  const { data: wheat, error: cropError } = await db
    .from('crops')
    .select('id')
    .eq('code', 'wheat')
    .maybeSingle();

  if (cropError) throw new Error(`Could not read the crop catalogue: ${cropError.message}`);
  if (!wheat) {
    throw new Error(
      'No wheat row in `crops`. Run supabase/migrations/0003_seed_reference_data.sql first.',
    );
  }

  const area = areaFromBoundary(DEMO_BOUNDARY);
  const seasons = rabiSeasons(new Date());

  const rows = [
    {
      farm_id: farmId,
      user_id: userId,
      crop_id: wheat.id,
      variety: 'Dara',
      sown_on: seasons.lastCompleted.sownOn,
      expected_harvest_on: seasons.lastCompleted.harvestOn,
      area_acres: Number(area.acres.toFixed(4)),
      status: 'harvested',
      notes: 'Demo data. Previous rabi season.',
    },
    {
      farm_id: farmId,
      user_id: userId,
      crop_id: wheat.id,
      variety: 'Sharbati',
      sown_on: seasons.upcoming.sownOn,
      expected_harvest_on: seasons.upcoming.harvestOn,
      area_acres: Number(area.acres.toFixed(4)),
      status: 'planned',
      notes: 'Demo data. Upcoming rabi season.',
    },
  ];

  const { error } = await db.from('farm_crops').insert(rows);
  if (error) throw new Error(`Could not create the demo crops: ${error.message}`);

  console.log(`  crops              wheat, ${rows.length} seasons`);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function seedDemoFarmer(): Promise<void> {
  const env = getEnv();

  if (env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed a demo farmer against NODE_ENV=production.');
  }

  console.log(`\nSeeding the demo farmer into ${env.SUPABASE_URL}\n`);

  // Service role: this writes another user's rows, which is exactly what RLS
  // exists to prevent. It is why this is a script and not an endpoint.
  const db = adminClient();

  const userId = await ensureAuthUser(db);
  await upsertProfile(db, userId);
  const farmId = await replaceFarm(db, userId);
  await seedFarmCrops(db, userId, farmId);

  console.log(`
Demo farmer ready. Sign in with:

  email      ${DEMO_FARMER.email}
  password   ${DEMO_FARMER.password}

This script writes no prices and no weather. Fill those with REAL data:

  npm run ingest:market     needs MARKET_API_KEY
  npm run ingest:weather    no key needed

Or run both plus this script in one go:  npm run demo:full
`);
}

// Run only when invoked directly, so the tests can import the helpers above.
const invokedDirectly = process.argv[1]?.includes('seedDemoFarmer');

if (invokedDirectly) {
  seedDemoFarmer().catch((error: unknown) => {
    console.error(`\n${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
