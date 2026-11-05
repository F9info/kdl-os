-- The per-project "brand-intake.<projectId>" contact fields were a second, never-used copy of the
-- company contact details (company details now live only in Application Identity). Their API is
-- gone. Remove the orphaned rows, but ONLY for a project whose copy was never filled in: if any
-- value (field default, setting value or project value) is non-empty, that project's rows stay.
-- Deleting the type cascades to its fields and their values. Re-running is a no-op.
DELETE FROM types t
WHERE t.slug LIKE 'brand-intake.%'
  AND NOT EXISTS (
    SELECT 1
    FROM setting_fields f
    LEFT JOIN setting_values v ON v.field_id = f.id
    LEFT JOIN project_setting_values pv ON pv.field_id = f.id
    WHERE f.type_id = t.id
      AND (
        btrim(coalesce(f.value, '')) <> ''
        OR btrim(coalesce(v.value, '')) <> ''
        OR btrim(coalesce(pv.value, '')) <> ''
      )
  );
