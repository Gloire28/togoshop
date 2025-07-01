import { S3Client } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: process.env.BACKBLAZE_REGION,
  endpoint: `https://${process.env.BACKBLAZE_ENDPOINT}`,
  credentials: {
    accessKeyId: process.env.BACKBLAZE_KEY_ID,
    secretAccessKey: process.env.BACKBLAZE_APPLICATION_KEY,
  },
  forcePathStyle: true,
  // Désactive tous les mécanismes de checksum
  disableBodySigning: true,
  // Ajoute une couche de compatibilité Backblaze
  customUserAgent: 'togoshop-backblaze-fix',
  // Désactive les headers problématiques
  requestHandler: {
    handle: (request) => {
      delete request.headers['x-amz-checksum-crc32'];
      delete request.headers['x-amz-checksum-crc32c'];
      delete request.headers['x-amz-checksum-sha1'];
      delete request.headers['x-amz-checksum-sha256'];
      return request;
    }
  }
});

export default s3Client;