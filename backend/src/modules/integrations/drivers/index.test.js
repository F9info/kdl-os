import { describe, it, expect } from 'vitest';
import registry, { getDriver } from './index.js';

describe('driver registry', () => {
  it('exports all 5 drivers', () => {
    expect(Object.keys(registry)).toEqual(['smtp', 'msg91', 'twilio', 'meta-cloud', 'gupshup']);
  });

  it('each driver has required exports', () => {
    for (const [name, d] of Object.entries(registry)) {
      expect(d.channel, `${name}.channel`).toMatch(/^(EMAIL|SMS|WHATSAPP)$/);
      expect(d.driver, `${name}.driver`).toBe(name);
      expect(d.credentialsSchema, `${name}.credentialsSchema`).toBeDefined();
      expect(d.configSchema, `${name}.configSchema`).toBeDefined();
      expect(typeof d.send, `${name}.send`).toBe('function');
      expect(typeof d.parseWebhook, `${name}.parseWebhook`).toBe('function');
    }
  });

  it('getDriver returns correct driver', () => {
    expect(getDriver('smtp').driver).toBe('smtp');
    expect(getDriver('msg91').driver).toBe('msg91');
    expect(getDriver('twilio').driver).toBe('twilio');
    expect(getDriver('meta-cloud').driver).toBe('meta-cloud');
    expect(getDriver('gupshup').driver).toBe('gupshup');
  });

  it('getDriver throws for unknown driver', () => {
    expect(() => getDriver('unknown')).toThrow('Unknown integration driver');
    expect(() => getDriver('')).toThrow('Unknown integration driver');
  });
});
