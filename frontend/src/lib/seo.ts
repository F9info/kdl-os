// Shared SEO types and limits (T6.1). Keep the limits in sync with backend page-builder/seo.js.
export const SEO_TITLE_MAX = 120
export const SEO_DESCRIPTION_MAX = 300
// Search engines usually cut a title after ~60 and a description after ~160 characters.
export const SEO_TITLE_HINT = 60
export const SEO_DESCRIPTION_HINT = 160

/** One page's own SEO; a missing key means "use the default". */
export interface PageSeo {
  title?: string
  description?: string
  og_image?: string
  canonical?: string
  noindex?: boolean
}

/** Site-wide defaults. `title_template` contains %s (the page title). */
export interface SeoDefaults {
  title_template: string
  default_og_image: string
}

/** What the public page payload carries for the defaults (image already resolved to a URL). */
export interface PublicSeoDefaults {
  title_template: string
  og_image: string
}
