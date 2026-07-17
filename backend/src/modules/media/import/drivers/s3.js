import { z } from 'zod';
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { assertPublicHost, assertPublicEndpoint } from '../../../../shared/utils/ssrf-guard.js';

const credentialsSchema = z.object({
  access_key_id: z.string().min(1),
  secret_access_key: z.string().min(1),
  bucket: z.string().min(1),
  region: z.string().optional().default('us-east-1'),
  endpoint: z.string().url().optional(),
});

const makeClient = async (credentials) => {
  if (credentials.endpoint) {
    const { hostname } = new URL(credentials.endpoint);
    await assertPublicHost(hostname);
  }
  return new S3Client({
    region: credentials.region || 'us-east-1',
    credentials: {
      accessKeyId: credentials.access_key_id,
      secretAccessKey: credentials.secret_access_key,
    },
    ...(credentials.endpoint ? { endpoint: credentials.endpoint, forcePathStyle: true } : {}),
  });
};

const getValidatedClient = async (credentials) => {
  if (credentials.endpoint) {
    await assertPublicEndpoint(credentials.endpoint);
  }
  return makeClient(credentials);
};

const streamToBuffer = async (stream) => {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
};

export default {
  provider: 's3',
  oauth: false,
  credentialsSchema,

  // Manual providers are always "configured" — the user supplies credentials directly.
  isAppConfigured: () => true,

  async list({ credentials, folderId, cursor }) {
    const client = await getValidatedClient(credentials);
    const prefix = folderId || '';
    const res = await client.send(new ListObjectsV2Command({
      Bucket: credentials.bucket,
      Prefix: prefix,
      Delimiter: '/',
      ContinuationToken: cursor || undefined,
      MaxKeys: 100,
    }));

    const folders = (res.CommonPrefixes ?? []).map((p) => ({
      id: p.Prefix,
      name: p.Prefix.replace(prefix, '').replace(/\/$/, ''),
      mimeType: null,
      size: null,
      isFolder: true,
    }));
    const files = (res.Contents ?? [])
      .filter((c) => c.Key !== prefix) // skip the "directory marker" object itself
      .map((c) => ({
        id: c.Key,
        name: c.Key.replace(prefix, ''),
        mimeType: null,
        size: c.Size ?? null,
        isFolder: false,
      }));

    return {
      items: [...folders, ...files],
      nextCursor: res.IsTruncated ? res.NextContinuationToken : null,
    };
  },

  async download({ credentials, fileId }) {
    const client = await getValidatedClient(credentials);
    const res = await client.send(new GetObjectCommand({ Bucket: credentials.bucket, Key: fileId }));
    const buffer = await streamToBuffer(res.Body);
    return { buffer, filename: fileId.split('/').pop(), mimeType: res.ContentType ?? null };
  },
};
