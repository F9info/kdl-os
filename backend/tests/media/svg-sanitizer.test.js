import { describe, it, expect } from 'vitest';
import { sanitizeSvg, isSvgMime } from '../../src/modules/media/svg-sanitizer.js';

const clean = (s) => sanitizeSvg(s).toString('utf8');

describe('sanitizeSvg', () => {
  it('strips <script> blocks', () => {
    const out = clean('<svg><script>alert(1)</script><rect width="10"/></svg>');
    expect(out).not.toContain('script');
    expect(out).not.toContain('alert');
    expect(out).toContain('<rect width="10"/>');
  });

  it('strips self-closing and uppercase script tags', () => {
    const out = clean('<svg><SCRIPT src="https://evil.com/x.js"/><circle r="5"/></svg>');
    expect(out.toLowerCase()).not.toContain('script');
    expect(out).toContain('<circle r="5"/>');
  });

  it('strips nested-evasion script tags (<scr<script>ipt>)', () => {
    const out = clean('<svg><scr<script></script>ipt>alert(1)</scr</script>ipt></svg>');
    expect(out).not.toMatch(/<script/i);
  });

  it('strips on* event handler attributes', () => {
    const out = clean(`<svg onload="alert(1)"><rect onclick='steal()' onmouseover=x width="4"/></svg>`);
    expect(out).not.toContain('onload');
    expect(out).not.toContain('onclick');
    expect(out).not.toContain('onmouseover');
    expect(out).toContain('width="4"');
  });

  it('strips javascript: hrefs but keeps normal hrefs', () => {
    const out = clean('<svg><a href="javascript:alert(1)">x</a><a href="https://ok.com">y</a></svg>');
    expect(out).not.toContain('javascript:');
    expect(out).toContain('https://ok.com');
  });

  it('strips xlink:href javascript and data:text/html URIs', () => {
    const out = clean(`<svg><use xlink:href="javascript:evil()"/><a href="data:text/html,<script>x</script>">z</a></svg>`);
    expect(out).not.toContain('javascript:');
    expect(out).not.toContain('data:text/html');
  });

  it('strips <foreignObject> blocks', () => {
    const out = clean('<svg><foreignObject><body xmlns="http://www.w3.org/1999/xhtml"><iframe src="x"/></body></foreignObject><rect/></svg>');
    expect(out).not.toContain('foreignObject');
    expect(out).not.toContain('iframe');
    expect(out).toContain('<rect/>');
  });

  it('strips DOCTYPE internal subsets and ENTITY declarations (billion laughs)', () => {
    const bomb = '<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY a "aaaa"><!ENTITY b "&a;&a;">]><svg>&b;</svg>';
    const out = clean(bomb);
    expect(out).not.toContain('<!ENTITY');
    expect(out).not.toContain('<!DOCTYPE');
    expect(out).toContain('<svg>');
  });

  it('leaves a benign SVG intact', () => {
    const benign = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2L2 22h20z" fill="#f00"/></svg>';
    expect(clean(benign)).toBe(benign);
  });

  it('accepts Buffer input and returns Buffer', () => {
    const out = sanitizeSvg(Buffer.from('<svg><script>x</script></svg>'));
    expect(Buffer.isBuffer(out)).toBe(true);
    expect(out.toString()).not.toContain('script');
  });
});

describe('isSvgMime', () => {
  it('matches only image/svg+xml', () => {
    expect(isSvgMime('image/svg+xml')).toBe(true);
    expect(isSvgMime('image/png')).toBe(false);
  });
});
