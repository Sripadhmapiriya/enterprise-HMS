import crypto from 'crypto';

export interface LicenseLimits {
  maxUsers?: number;
  maxBeds?: number;
  maxHospitals?: number;
  users?: number;
  beds?: number;
  hospitals?: number;
}

export interface LicensePayload {
  clientId: string;
  clientName: string;
  tier?: string;
  modules: string[];
  limits: LicenseLimits;
  issuedAt: string; // ISO 8601
  expiresAt: string; // ISO 8601
  gracePeriodDays?: number; // default 14 days
}

export interface SignedLicense {
  payload: LicensePayload;
  signature: string; // base64
  publicKey: string; // SPKI PEM format or base64 DER
}

export interface LicenseVerificationResult {
  isValid: boolean;
  isExpired: boolean;
  inGracePeriod: boolean;
  isReadOnly: boolean;
  readOnly: boolean; // alias for isReadOnly
  daysRemaining: number;
  error?: string;
  reason?: string; // alias for error
  payload?: LicensePayload;
}

/**
 * Generates an Ed25519 public/private keypair in PKCS8 / SPKI PEM format.
 */
export function generateEd25519KeyPair(): { publicKey: string; privateKey: string } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { publicKey, privateKey };
}

/**
 * Creates and signs a license using the Ed25519 private key.
 */
export function issueLicense(
  payload: LicensePayload,
  privateKeyPem: string,
  publicKeyPem?: string
): SignedLicense {
  const canonicalData = Buffer.from(JSON.stringify(payload, Object.keys(payload).sort()));
  const signature = crypto.sign(null, canonicalData, privateKeyPem).toString('base64');

  return {
    payload,
    signature,
    publicKey: publicKeyPem || '',
  };
}

/**
 * Verifies an Ed25519-signed license.
 * Enforces startup validation, expiration, and clinical safety grace periods.
 */
export function verifyLicense(
  signedLicense: SignedLicense,
  trustedPublicKeyPem?: string
): LicenseVerificationResult {
  try {
    const keyToUse = trustedPublicKeyPem || signedLicense.publicKey;
    if (!keyToUse) {
      return {
        isValid: false,
        isExpired: false,
        inGracePeriod: false,
        isReadOnly: true,
        readOnly: true,
        daysRemaining: 0,
        error: 'MISSING_PUBLIC_KEY',
        reason: 'MISSING_PUBLIC_KEY',
      };
    }

    const canonicalData = Buffer.from(
      JSON.stringify(signedLicense.payload, Object.keys(signedLicense.payload).sort())
    );
    const signatureBuffer = Buffer.from(signedLicense.signature, 'base64');

    const isSignatureValid = crypto.verify(null, canonicalData, keyToUse, signatureBuffer);
    if (!isSignatureValid) {
      return {
        isValid: false,
        isExpired: false,
        inGracePeriod: false,
        isReadOnly: true,
        readOnly: true,
        daysRemaining: 0,
        error: 'INVALID_SIGNATURE',
        reason: 'INVALID_SIGNATURE',
        payload: signedLicense.payload,
      };
    }

    const now = new Date().getTime();
    const expiresAt = new Date(signedLicense.payload.expiresAt).getTime();
    const gracePeriodDays = signedLicense.payload.gracePeriodDays ?? 14;
    const gracePeriodMs = gracePeriodDays * 24 * 60 * 60 * 1000;
    const finalCutoff = expiresAt + gracePeriodMs;

    const diffDays = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));

    if (now <= expiresAt) {
      // Fully valid
      return {
        isValid: true,
        isExpired: false,
        inGracePeriod: false,
        isReadOnly: false,
        readOnly: false,
        daysRemaining: diffDays,
        payload: signedLicense.payload,
      };
    }

    if (now <= finalCutoff) {
      // In clinical grace period: warn heavily but keep fully active for patient care
      return {
        isValid: false,
        isExpired: true,
        inGracePeriod: true,
        isReadOnly: false,
        readOnly: false,
        daysRemaining: 0,
        error: 'LICENSE_EXPIRED_GRACE_PERIOD',
        reason: 'LICENSE_EXPIRED_GRACE_PERIOD',
        payload: signedLicense.payload,
      };
    }

    // Past grace period: enters READ-ONLY mode.
    // Clinical safety principle: NEVER block read access to existing patient records.
    return {
      isValid: false,
      isExpired: true,
      inGracePeriod: false,
      isReadOnly: true,
      readOnly: true,
      daysRemaining: 0,
      error: 'LICENSE_EXPIRED_READ_ONLY',
      reason: 'LICENSE_EXPIRED_READ_ONLY',
      payload: signedLicense.payload,
    };
  } catch (err: any) {
    return {
      isValid: false,
      isExpired: false,
      inGracePeriod: false,
      isReadOnly: true,
      readOnly: true,
      daysRemaining: 0,
      error: `VERIFICATION_FAILED: ${err?.message || 'Unknown error'}`,
      reason: `VERIFICATION_FAILED: ${err?.message || 'Unknown error'}`,
    };
  }
}

/**
 * LicensingService class wrapping the standalone functions as static methods.
 * Tests and application code can use either the standalone functions or LicensingService.
 */
export class LicensingService {
  static generateKeyPair = generateEd25519KeyPair;
  static issueLicense = issueLicense;
  static verifyLicense = verifyLicense;
}
