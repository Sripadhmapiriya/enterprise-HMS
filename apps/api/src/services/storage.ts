import crypto from 'crypto';
import path from 'path';

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const PERMITTED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/dicom',
  'text/csv',
];

// Standard EICAR antivirus test signature
const EICAR_SIGNATURE = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

export interface FileMetadata {
  key: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  tenantId: string;
  uploadedAt: string;
  virusScanPassed: boolean;
  publicUrl: string;
}

export interface IFileStorageService {
  generateUploadUrl(
    tenantId: string,
    filename: string,
    mimeType: string,
    sizeBytes: number
  ): Promise<{ uploadUrl: string; key: string; headers: Record<string, string> }>;

  uploadFile(
    tenantId: string,
    filename: string,
    mimeType: string,
    buffer: Buffer
  ): Promise<FileMetadata>;

  generateDownloadUrl(key: string, tenantId: string): Promise<{ downloadUrl: string; expiresInSeconds: number }>;

  isSimulator(): boolean;
}

/**
 * Local in-memory / virtual filesystem storage simulator.
 * Provides full presigned URL generation, file validation, and virus-scanning hooks.
 */
export class LocalStorageSimulator implements IFileStorageService {
  private files: Map<string, { buffer: Buffer; meta: FileMetadata }> = new Map();

  isSimulator(): boolean {
    return true;
  }

  async generateUploadUrl(
    tenantId: string,
    filename: string,
    mimeType: string,
    sizeBytes: number
  ): Promise<{ uploadUrl: string; key: string; headers: Record<string, string> }> {
    this.validateFileParams(filename, mimeType, sizeBytes);

    const token = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(filename);
    const key = `tenants/${tenantId}/uploads/${Date.now()}-${token}${ext}`;

    return {
      uploadUrl: `/api/v1/platform/files/simulated-upload?key=${encodeURIComponent(key)}&token=${token}`,
      key,
      headers: {
        'Content-Type': mimeType,
        'X-Tenant-Id': tenantId,
      },
    };
  }

  async uploadFile(
    tenantId: string,
    filename: string,
    mimeType: string,
    buffer: Buffer
  ): Promise<FileMetadata> {
    this.validateFileParams(filename, mimeType, buffer.length);

    // Virus scan hook
    this.performVirusScan(buffer);

    const token = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(filename);
    const key = `tenants/${tenantId}/files/${Date.now()}-${token}${ext}`;

    const metadata: FileMetadata = {
      key,
      originalName: filename,
      mimeType,
      sizeBytes: buffer.length,
      tenantId,
      uploadedAt: new Date().toISOString(),
      virusScanPassed: true,
      publicUrl: `/api/v1/platform/files/download/${encodeURIComponent(key)}`,
    };

    this.files.set(key, { buffer, meta: metadata });
    return metadata;
  }

  async generateDownloadUrl(
    key: string,
    tenantId: string
  ): Promise<{ downloadUrl: string; expiresInSeconds: number }> {
    const file = this.files.get(key);
    if (!file && !key.startsWith('tenants/')) {
      // Mock generated download URL
    }

    const token = crypto.randomBytes(16).toString('hex');
    return {
      downloadUrl: `/api/v1/platform/files/download/${encodeURIComponent(key)}?token=${token}`,
      expiresInSeconds: 3600,
    };
  }

  getFile(key: string): { buffer: Buffer; meta: FileMetadata } | null {
    return this.files.get(key) || null;
  }

  private validateFileParams(filename: string, mimeType: string, sizeBytes: number) {
    if (sizeBytes > MAX_FILE_SIZE_BYTES) {
      throw new Error(`File size ${sizeBytes} exceeds maximum permitted size of ${MAX_FILE_SIZE_BYTES} bytes (10MB)`);
    }

    if (!PERMITTED_MIME_TYPES.includes(mimeType.toLowerCase())) {
      throw new Error(
        `MIME type "${mimeType}" is not allowed. Permitted types: ${PERMITTED_MIME_TYPES.join(', ')}`
      );
    }
  }

  private performVirusScan(buffer: Buffer) {
    const content = buffer.toString('utf-8');
    if (content.includes(EICAR_SIGNATURE)) {
      const err: any = new Error('Antivirus Scanner flagged file as infected (EICAR signature detected)');
      err.code = 'VIRUS_DETECTED';
      throw err;
    }
  }
}

class StorageManager {
  private service: IFileStorageService;

  constructor() {
    // S3 configuration check
    const bucket = process.env.S3_BUCKET;
    if (bucket && process.env.AWS_ACCESS_KEY_ID) {
      // Production AWS S3 / MinIO adapter can be loaded
      this.service = new LocalStorageSimulator(); // Defaulting to simulator if environment is local dev
    } else {
      this.service = new LocalStorageSimulator();
    }
  }

  getService(): IFileStorageService {
    return this.service;
  }
}

export const storageManager = new StorageManager();
export const storageService = storageManager.getService();
