/**
 * Cloudflare R2 Service
 * ------------------------------------------------------------------
 * Thin wrapper around the AWS S3-compatible client pointed at R2.
 *
 * Required env vars:
 *   CLOUDFLARE_R2_ACCOUNT_ID   – your Cloudflare account ID (R2 overview page)
 *   R2_ACCESS_KEY_ID           – R2 API token "Access Key ID"
 *   R2_SECRET_ACCESS_KEY       – R2 API token "Secret Access Key"
 *   R2_BUCKET_NAME             – name of the R2 bucket (e.g. findden-media)
 *   R2_PUBLIC_URL              – PUBLIC base URL — NOT the cloudflarestorage.com endpoint.
 *                                How to get it:
 *                                  1. Cloudflare Dashboard → R2 → your bucket → Settings
 *                                  2. Enable "Public access" under "Public bucket URL"
 *                                  3. Copy the URL: https://pub-<hash>.r2.dev
 *                                  4. Set R2_PUBLIC_URL=https://pub-<hash>.r2.dev
 *                                OR use a custom domain connected to the bucket.
 *
 * NOTE: R2 does NOT support per-object ACLs (unlike AWS S3).
 * Public access is controlled at the bucket level in the Cloudflare dashboard.
 * Do not send ACL headers — they cause InvalidArgument errors.
 */

const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { r2 } = require('../config/env');

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${r2.accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: r2.accessKeyId,
    secretAccessKey: r2.secretAccessKey,
  },
});

const R2Service = {
  /**
   * Upload a Buffer to R2.
   * @param {Buffer}  buffer    - file contents
   * @param {string}  key       - object key, e.g. "properties/<userId>/<uuid>.jpg"
   * @param {string}  mimeType  - MIME type, e.g. "image/jpeg"
   * @returns {string} full public URL
   */
  async uploadBuffer(buffer, key, mimeType) {
    await client.send(
      new PutObjectCommand({
        Bucket: r2.bucketName,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        // No ACL — R2 manages public access at the bucket level, not per object.
      })
    );
    return `${r2.publicUrl}/${key}`;
  },

  /**
   * Delete an object from R2.
   * @param {string} key - object key
   */
  async deleteObject(key) {
    await client.send(
      new DeleteObjectCommand({
        Bucket: r2.bucketName,
        Key: key,
      })
    );
  },
};

module.exports = R2Service;
