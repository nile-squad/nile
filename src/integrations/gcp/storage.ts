import { Storage } from '@google-cloud/storage';
import { createLog } from '@nile/src/logging/logger';

// Load environment variables
const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET_NAME;
const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
const keyFilePath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

/**
 * Uploads a file to Google Cloud Storage.
 * @param filePath - Local path to the file.
 * @param destination - Destination path in the bucket.
 * @returns {Promise<string>} - Public URL of the uploaded file.
 */
export async function uploadFile(
  filePath: string,
  destination: string
): Promise<string> {
  // Check if all required environment variables are set
  if (!(bucketName && projectId && keyFilePath)) {
    throw new Error(
      'Missing required environment variables for Google Cloud Storage.'
    );
  }

  // Initialize Google Cloud Storage
  const storage = new Storage({
    projectId,
    keyFilename: keyFilePath,
  });

  const bucket = storage.bucket(bucketName);

  try {
    const [file] = await bucket.upload(filePath, { destination });

    // Make the file publicly accessible
    await file.makePublic();

    return `https://storage.googleapis.com/${bucketName}/${destination}`;
  } catch (error) {
    createLog({
      message: 'Error uploading file to Google Cloud Storage',
      data: error,
      type: 'error',
      atFunction: 'uploadFile',
      appName: 'GCP',
    });
    throw error;
  }
}

/**
 * Uploads a file buffer (from a request, for example) to Google Cloud Storage.
 * @param fileName - The desired name of the file in the bucket.
 * @param fileType - MIME type of the file.
 * @param fileBuffer - The file data as a Buffer.
 * @returns {Promise<string>} - Public URL of the uploaded file.
 */
export async function uploadBuffer(
  fileName: string,
  fileType: string,
  fileBuffer: Buffer
): Promise<string> {
  // Check if all required environment variables are set
  if (!(bucketName && projectId && keyFilePath)) {
    throw new Error(
      'Missing required environment variables for Google Cloud Storage.'
    );
  }

  // Initialize Google Cloud Storage
  const storage = new Storage({
    projectId,
    keyFilename: keyFilePath,
  });

  const bucket = storage.bucket(bucketName);

  try {
    const file = bucket.file(fileName);
    await file.save(fileBuffer, { contentType: fileType, public: true });
    // await file.makePublic();
    return `https://storage.googleapis.com/${bucketName}/${fileName}`;
  } catch (error) {
    createLog({
      message: 'Error uploading buffer to Google Cloud Storage',
      data: error,
      type: 'error',
      atFunction: 'uploadBuffer',
      appName: 'GCP',
    });
    throw error;
  }
}
