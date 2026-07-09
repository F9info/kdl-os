// S3 bucket import driver (any S3-compatible endpoint via `endpoint` cred). Same
// contract as gdrive.js. File ids are object keys; folder ids are key prefixes.
// `deps.clientFactory(creds)` is injectable for tests (must return { send }).

const makeClient = async (creds, deps = {}) => {
  if (deps.clientFactory) return deps.clientFactory(creds);
  const { S3Client } = await import('@aws-sdk/client-s3');
  return new S3Client({
    region: creds.region || 'us-east-1',
    endpoint: creds.endpoint || undefined,
    forcePathStyle: !!creds.endpoint, // MinIO/R2-style endpoints need path-style
    credentials: {
      accessKeyId: creds.access_key_id,
      secretAccessKey: creds.secret_access_key,
    },
  });
};

const basename = (key) => key.replace(/\/$/, '').split('/').pop();

export default {
  name: 's3',
  auth: 'credentials',

  async list(creds, { path, cursor } = {}, deps = {}) {
    const client = await makeClient(creds, deps);
    const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');

    let prefix = path || '';
    if (prefix && !prefix.endsWith('/')) prefix += '/';

    const data = await client.send(new ListObjectsV2Command({
      Bucket: creds.bucket,
      Prefix: prefix,
      Delimiter: '/',
      MaxKeys: 100,
      ContinuationToken: cursor || undefined,
    }));

    const folders = (data.CommonPrefixes ?? []).map((p) => ({
      id: p.Prefix,
      name: basename(p.Prefix),
      size: null,
      mime: null,
      is_folder: true,
    }));
    const files = (data.Contents ?? [])
      .filter((o) => o.Key !== prefix && !o.Key.endsWith('/'))
      .map((o) => ({
        id: o.Key,
        name: basename(o.Key),
        size: o.Size ?? null,
        mime: null, // resolved from extension at import time
        is_folder: false,
      }));

    return { entries: [...folders, ...files], cursor: data.NextContinuationToken ?? null };
  },

  async download(creds, key, deps = {}) {
    const client = await makeClient(creds, deps);
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');

    const data = await client.send(new GetObjectCommand({ Bucket: creds.bucket, Key: key }));
    const buffer = Buffer.from(await data.Body.transformToByteArray());
    const mime = (data.ContentType ?? '').split(';')[0].trim() || null;
    return {
      buffer,
      name: basename(key),
      mime: mime === 'application/octet-stream' ? null : mime, // generic type ⇒ fall back to extension
      size: buffer.length,
    };
  },
};
