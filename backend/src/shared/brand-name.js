// The company name for generated content (sample FAQs, team roles, starter pages): Application Identity, never a
// name written into the code. `BRAND_PLACEHOLDER` is only what shows until a company name has been entered.
export const BRAND_PLACEHOLDER = 'Your Brand';

/** The word sample copy is written with; it is swapped for the real company name when the copy is created. */
export const SAMPLE_BRAND_TOKEN = 'DemoLogo';

export async function brandName(client) {
  for (const key of ['identity.company_name', 'identity.app_name']) {
    const row = await client.appSetting.findUnique({ where: { key } });
    if (row?.value?.trim()) return row.value.trim();
  }
  return BRAND_PLACEHOLDER;
}

/** Sample copy with its placeholder company word replaced by the real name. */
export const withBrand = (text, brand) => String(text).replaceAll(SAMPLE_BRAND_TOKEN, brand);
