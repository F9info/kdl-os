// Gap-free counters. One row per counter in membership_settings; the upsert takes a row lock, so two
// concurrent callers queue up, and a rolled-back transaction gives its number back. Call inside the
// same transaction that uses the number.
export async function nextSeq(tx, key) {
  const rows = await tx.$queryRaw`
    INSERT INTO membership_settings ("key", "value", "updated_at")
    VALUES (${'seq:' + key}, '1'::jsonb, now())
    ON CONFLICT ("key") DO UPDATE
      SET "value" = to_jsonb((membership_settings."value" #>> '{}')::int + 1), "updated_at" = now()
    RETURNING ("value" #>> '{}')::int AS n`;
  return rows[0].n;
}
