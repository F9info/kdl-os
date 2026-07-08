import net from 'node:net';

// Minimal clamd TCP client (INSTREAM protocol). No clamd → callers decide
// whether to skip or retry; this module only talks the wire protocol.

const CHUNK_SIZE = 64 * 1024;

export const clamdConfig = () => ({
  host: process.env.CLAMAV_HOST || null,
  port: Number(process.env.CLAMAV_PORT || 3310),
  timeoutMs: Number(process.env.CLAMAV_TIMEOUT_MS || 30_000),
});

export const isClamdConfigured = () => Boolean(clamdConfig().host);

// Parse a clamd INSTREAM/SCAN reply line into { status, signature }.
// "stream: OK" → CLEAN; "stream: Eicar-Signature FOUND" → INFECTED.
export const parseClamdResponse = (raw) => {
  const line = raw.replace(/\0/g, '').trim();
  if (/\bOK$/.test(line)) return { status: 'CLEAN', signature: null };
  const found = line.match(/^stream:\s*(.+)\s+FOUND$/i);
  if (found) return { status: 'INFECTED', signature: found[1].trim() };
  throw new Error(`clamd unexpected response: ${line || '(empty)'}`);
};

export const scanBuffer = (buffer, config = clamdConfig()) => {
  const { host, port, timeoutMs } = config;
  if (!host) return Promise.reject(new Error('clamd not configured (CLAMAV_HOST unset)'));

  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port });
    let response = '';
    let settled = false;
    const fail = (err) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      reject(err);
    };

    socket.setTimeout(timeoutMs, () => fail(new Error(`clamd timeout after ${timeoutMs}ms`)));
    socket.on('error', fail);

    socket.on('connect', () => {
      socket.write('zINSTREAM\0');
      for (let offset = 0; offset < buffer.length; offset += CHUNK_SIZE) {
        const chunk = buffer.subarray(offset, offset + CHUNK_SIZE);
        const sizeHeader = Buffer.alloc(4);
        sizeHeader.writeUInt32BE(chunk.length, 0);
        socket.write(sizeHeader);
        socket.write(chunk);
      }
      // Zero-length chunk terminates the stream
      socket.write(Buffer.from([0, 0, 0, 0]));
    });

    socket.on('data', (data) => {
      response += data.toString();
      if (response.includes('\0') || response.includes('\n')) socket.end();
    });

    socket.on('close', () => {
      if (settled) return;
      settled = true;
      try {
        resolve(parseClamdResponse(response));
      } catch (err) {
        reject(err);
      }
    });
  });
};
