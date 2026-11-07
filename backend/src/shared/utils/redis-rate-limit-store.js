// express-rate-limit store backed by Redis, so limits hold across restarts and across backend instances.
// (The default store is per-process memory: every restart or second instance resets the counters.)
// If Redis is down the limiter fails open for that request: login still has the nginx limit and the account lockout.
import { redis } from '../../config/redis.js';

export class RedisRateLimitStore {
  constructor(prefix) {
    this.prefix = `rl:${prefix}:`;
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  async increment(key) {
    const k = this.prefix + key;
    try {
      const hits = await redis.incr(k);
      if (hits === 1) await redis.pexpire(k, this.windowMs);
      const ttl = await redis.pttl(k);
      if (ttl < 0) await redis.pexpire(k, this.windowMs); // a crash between INCR and PEXPIRE must not leave a key forever
      return { totalHits: hits, resetTime: new Date(Date.now() + (ttl > 0 ? ttl : this.windowMs)) };
    } catch {
      return { totalHits: 1, resetTime: new Date(Date.now() + this.windowMs) };
    }
  }

  async decrement(key) {
    try { await redis.decr(this.prefix + key); } catch { /* ignore */ }
  }

  async resetKey(key) {
    try { await redis.del(this.prefix + key); } catch { /* ignore */ }
  }
}
