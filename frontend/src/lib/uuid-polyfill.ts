// `crypto.randomUUID` only exists in secure contexts (HTTPS or localhost). The page-builder library
// calls it when it loads, so a site served over plain HTTP from any other host (a LAN IP, a staging
// domain without TLS, a custom site domain) would crash on first render. This script runs inline in
// <head>, before the app bundles, and adds a standards-shaped version 4 UUID where it is missing.
export const UUID_POLYFILL = `(function(){var c=self.crypto;if(c&&!c.randomUUID&&c.getRandomValues){c.randomUUID=function(){var b=c.getRandomValues(new Uint8Array(16));b[6]=b[6]&15|64;b[8]=b[8]&63|128;var h=[].map.call(b,function(x){return(x+256).toString(16).slice(1)});return h.slice(0,4).join('')+'-'+h.slice(4,6).join('')+'-'+h.slice(6,8).join('')+'-'+h.slice(8,10).join('')+'-'+h.slice(10).join('')}}})();`
