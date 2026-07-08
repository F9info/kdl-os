import smtp from './smtp.js';
import msg91 from './msg91.js';
import twilio from './twilio.js';
import metaCloud from './meta-cloud.js';
import gupshup from './gupshup.js';

const registry = {
  smtp,
  msg91,
  twilio,
  'meta-cloud': metaCloud,
  gupshup,
};

export default registry;

export function getDriver(driverName) {
  const d = registry[driverName];
  if (!d) throw new Error(`Unknown integration driver: ${driverName}`);
  return d;
}
