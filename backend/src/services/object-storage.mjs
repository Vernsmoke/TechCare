import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { dataDir } from '../config/db.mjs';

let client;

function b2Config() {
  const values = [
    process.env.TECHCARE_B2_BUCKET,
    process.env.TECHCARE_B2_ENDPOINT,
    process.env.TECHCARE_B2_REGION,
    process.env.TECHCARE_B2_KEY_ID,
    process.env.TECHCARE_B2_APPLICATION_KEY,
  ];
  const configured = values.filter(Boolean).length;
  if (configured && configured !== values.length)
    throw new Error('Backblaze B2 configuration is incomplete.');
  if (configured !== values.length) return null;
  const config = {
    bucket: values[0],
    endpoint: values[1],
    region: values[2],
    keyId: values[3],
    applicationKey: values[4],
  };
  let endpoint;
  try {
    endpoint = new URL(config.endpoint);
  } catch {
    throw new Error('TECHCARE_B2_ENDPOINT must be a valid HTTPS URL.');
  }
  if (
    !endpoint.hostname ||
    endpoint.username ||
    endpoint.password ||
    (process.env.NODE_ENV === 'production' && endpoint.protocol !== 'https:')
  )
    throw new Error('Production Backblaze B2 endpoints must use HTTPS and contain no credentials.');
  return config;
}

function s3(config) {
  if (!client) {
    client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.keyId,
        secretAccessKey: config.applicationKey,
      },
      maxAttempts: 3,
    });
  }
  return client;
}

function localPath(key) {
  if (!/^media\/[a-f0-9]{40}\.(webp|mp4|webm)$/.test(key))
    throw new Error('Invalid object-storage key.');
  return join(dataDir(), key);
}

export function assertObjectStorageConfig() {
  const config = b2Config();
  if (process.env.NODE_ENV === 'production' && !config)
    throw new Error('Configure Backblaze B2 before starting in production.');
}

export async function putObject(key, body, contentType) {
  const config = b2Config();
  if (config) {
    await s3(config).send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: body,
        ContentLength: body.length,
        ContentType: contentType,
        CacheControl: 'private, no-store',
      }),
    );
    return;
  }
  if (process.env.NODE_ENV === 'production')
    throw new Error('Backblaze B2 is required in production.');
  const path = localPath(key);
  await mkdir(join(dataDir(), 'media'), { recursive: true });
  await writeFile(path, body, { flag: 'wx' });
}

export async function getObject(key) {
  const config = b2Config();
  if (config) {
    const result = await s3(config).send(new GetObjectCommand({ Bucket: config.bucket, Key: key }));
    if (!result.Body) throw new Error('The stored media object has no body.');
    return Buffer.from(await result.Body.transformToByteArray());
  }
  return readFile(localPath(key));
}

export async function removeObject(key) {
  const config = b2Config();
  if (config) {
    await s3(config).send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
    return;
  }
  if (process.env.NODE_ENV === 'production')
    throw new Error('Backblaze B2 is required in production.');
  await unlink(localPath(key));
}
