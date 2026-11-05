-- Company details now live only in Application Identity (app_settings "identity.*").
-- The older Company Details form kept a second copy in the "brand-profile-*" setting fields.
-- Copy what the user saved there into Identity, only where Identity has no value yet.
-- Re-running is a no-op. The legacy rows are left in place (nothing the user saved is deleted),
-- but nothing reads or writes them any more.
WITH legacy AS (
  SELECT
    max(CASE WHEN slug = 'brand-profile-company-name'    THEN btrim(value) END) AS app_name,
    max(CASE WHEN slug = 'brand-profile-primary-email'   THEN btrim(value) END) AS contact_email,
    max(CASE WHEN slug = 'brand-profile-primary-phone'   THEN btrim(value) END) AS contact_phone,
    max(CASE WHEN slug = 'brand-profile-secondary-email' THEN btrim(value) END) AS contact_email_secondary,
    max(CASE WHEN slug = 'brand-profile-secondary-phone' THEN btrim(value) END) AS contact_phone_secondary,
    max(CASE WHEN slug = 'logo'                          THEN btrim(value) END) AS logo_light,
    concat_ws(', ',
      nullif(max(CASE WHEN slug = 'brand-profile-address-1' THEN btrim(value) END), ''),
      nullif(max(CASE WHEN slug = 'brand-profile-address-2' THEN btrim(value) END), '')
    ) AS contact_address
  FROM setting_fields
  WHERE slug IN (
    'brand-profile-company-name', 'brand-profile-primary-email', 'brand-profile-primary-phone',
    'brand-profile-secondary-email', 'brand-profile-secondary-phone',
    'brand-profile-address-1', 'brand-profile-address-2', 'logo'
  )
),
wanted(key, value) AS (
  SELECT 'identity.app_name', app_name FROM legacy
  UNION ALL SELECT 'identity.app_title', app_name FROM legacy
  UNION ALL SELECT 'identity.contact_email', contact_email FROM legacy
  UNION ALL SELECT 'identity.contact_phone', contact_phone FROM legacy
  UNION ALL SELECT 'identity.contact_email_secondary', contact_email_secondary FROM legacy
  UNION ALL SELECT 'identity.contact_phone_secondary', contact_phone_secondary FROM legacy
  UNION ALL SELECT 'identity.contact_address', contact_address FROM legacy
  UNION ALL SELECT 'identity.logo_light', logo_light FROM legacy
)
INSERT INTO app_settings (id, key, value, type, description, is_public, created_at, updated_at)
SELECT gen_random_uuid()::text, w.key, w.value, 'string',
       'Application identity: ' || substr(w.key, 10), false, now(), now()
FROM wanted w
WHERE coalesce(w.value, '') <> ''
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value, updated_at = now()
  WHERE btrim(app_settings.value) = '';
