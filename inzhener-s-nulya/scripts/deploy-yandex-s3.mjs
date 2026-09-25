import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CreateBucketCommand, HeadBucketCommand, PutBucketWebsiteCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist-yandex');
const accessKeyId = process.env.YC_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.YC_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
const bucket = process.env.YC_BUCKET || process.env.S3_BUCKET || 'inzhener-s-nulya';

if (!accessKeyId || !secretAccessKey) {
  throw new Error('Set YC_ACCESS_KEY_ID and YC_SECRET_ACCESS_KEY in the local process environment. Do not put secrets in chat or files.');
}
if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)) throw new Error(`Invalid bucket name: ${bucket}`);

const client = new S3Client({
  region: 'ru-central1',
  endpoint: 'https://storage.yandexcloud.net',
  credentials: { accessKeyId, secretAccessKey }
});

try {
  await client.send(new HeadBucketCommand({ Bucket: bucket }));
} catch (error) {
  const code = Number(error?.$metadata?.httpStatusCode || 0);
  if (code && code !== 404) throw error;
  await client.send(new CreateBucketCommand({ Bucket: bucket, ACL: 'public-read' }));
}

const contentType = (name) => name.endsWith('.css') ? 'text/css; charset=utf-8'
  : name.endsWith('.js') ? 'text/javascript; charset=utf-8'
  : name.endsWith('.txt') ? 'text/plain; charset=utf-8'
  : 'text/html; charset=utf-8';

for (const name of await readdir(dist)) {
  const file = path.join(dist, name);
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: name,
    Body: await readFile(file),
    ContentType: contentType(name),
    CacheControl: name === 'index.html' ? 'no-cache' : 'public, max-age=300',
    ACL: 'public-read'
  }));
}

await client.send(new PutBucketWebsiteCommand({
  Bucket: bucket,
  WebsiteConfiguration: {
    IndexDocument: { Suffix: 'index.html' },
    ErrorDocument: { Key: '404.html' }
  }
}));

console.log(JSON.stringify({
  bucket,
  websiteUrl: `https://${bucket}.website.yandexcloud.net`,
  evidenceUrl: `https://${bucket}.website.yandexcloud.net/offer`
}, null, 2));
