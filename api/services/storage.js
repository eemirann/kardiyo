/**
 * Cloudflare R2 (S3 uyumlu) dosya yukleme.
 * Tarayici dosyayi dogrudan R2'ye yukler; API sadece imzali URL uretir.
 * R2 degiskenleri bos ise yukleme kapali olur (YouTube/Vimeo linki calismaya devam eder).
 */
const crypto = require('crypto');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { badRequest } = require('../utils/http');

const isEnabled = () =>
  Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET
  );

let client = null;
function getClient() {
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return client;
}

const ALLOWED = {
  video: ['video/mp4', 'video/webm', 'video/quicktime'],
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
};
const MAX_BYTES = { video: 2 * 1024 * 1024 * 1024, image: 5 * 1024 * 1024 };

/** Yukleme icin imzali PUT adresi + dosyanin nihai genel adresini uretir. */
async function createUploadUrl({ kind, filename, contentType, sizeBytes }) {
  if (!isEnabled()) throw badRequest('Dosya yukleme yapilandirilmamis (R2 ayarlari eksik).');
  if (!ALLOWED[kind]) throw badRequest('Gecersiz dosya turu.');
  if (!ALLOWED[kind].includes(contentType))
    throw badRequest(`Desteklenmeyen format. Izinliler: ${ALLOWED[kind].join(', ')}`);
  if (sizeBytes && sizeBytes > MAX_BYTES[kind])
    throw badRequest(`Dosya cok buyuk. Ust sinir: ${MAX_BYTES[kind] / (1024 * 1024)} MB`);

  const safeName = String(filename || 'dosya')
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .slice(-80);
  const key = `${kind}/${new Date().toISOString().slice(0, 10)}/${crypto
    .randomBytes(8)
    .toString('hex')}-${safeName}`;

  const uploadUrl = await getSignedUrl(
    getClient(),
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: 3600 }
  );

  return { uploadUrl, key, publicUrl: publicUrlFor(key) };
}

function publicUrlFor(key) {
  if (!key) return null;
  const base = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');
  return base ? `${base}/${key}` : null;
}

async function deleteObject(key) {
  if (!isEnabled() || !key) return;
  await getClient().send(
    new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key })
  );
}

module.exports = { isEnabled, createUploadUrl, publicUrlFor, deleteObject, ALLOWED, MAX_BYTES };
