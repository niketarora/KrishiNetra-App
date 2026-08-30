import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

import { adminClient } from '../../config/supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const schemeRecordSchema = z.object({
  row_id: z.string().min(1),
  scheme_id: z.string().min(1),
  state: z.string().min(1),
  scheme_scope: z.enum(['CENTRAL', 'STATE']),
  name: z.string().min(1),
  short_title: z.string().nullish(),
  category: z.string().nullish(),
  what_is_it: z.string().nullish(),
  potential_benefit: z.string().nullish(),
  who_may_be_eligible: z.string().nullish(),
  documents: z.array(z.string()).default([]),
  how_to_apply: z.string().nullish(),
  official_source: z.string().nullish(),
  myscheme_url: z.string().nullish(),
  department: z.string().nullish(),
  tags: z.array(z.string()).default([]),
  application_modes: z.array(z.string()).default([]),
});

export type IngestedSchemeRecord = z.infer<typeof schemeRecordSchema>;

export type SchemesIngestionReport = {
  totalRead: number;
  written: number;
  skipped: Array<{ reason: string; count: number }>;
};

const BATCH_SIZE = 500;

export async function runSchemesIngestion(customFilePath?: string): Promise<SchemesIngestionReport> {
  const filePath =
    customFilePath ?? path.resolve(__dirname, '../../../data/krishinetra_government_schemes_supabase.json');

  const content = await readFile(filePath, 'utf-8');
  const rawRecords = JSON.parse(content) as unknown[];

  const validRecords: IngestedSchemeRecord[] = [];
  const skipReasons: Record<string, number> = {};

  for (const raw of rawRecords) {
    const result = schemeRecordSchema.safeParse(raw);
    if (!result.success) {
      const reason = result.error.issues[0]?.message || 'Validation failed';
      skipReasons[reason] = (skipReasons[reason] || 0) + 1;
    } else {
      validRecords.push(result.data);
    }
  }

  const admin = adminClient();
  let written = 0;

  for (let i = 0; i < validRecords.length; i += BATCH_SIZE) {
    const chunk = validRecords.slice(i, i + BATCH_SIZE);
    const { error } = await admin
      .from('government_schemes')
      .upsert(chunk, { onConflict: 'row_id' });

    if (error) {
      throw new Error(`Database error during batch ingestion at offset ${i}: ${error.message}`);
    }

    written += chunk.length;
  }

  const skipped = Object.entries(skipReasons).map(([reason, count]) => ({ reason, count }));

  return {
    totalRead: rawRecords.length,
    written,
    skipped,
  };
}
