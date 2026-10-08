import crypto from 'crypto';

export interface AbhaGenerateRequest {
  aadhaarOrMobile: string;
  name: string;
  gender: string;
  yearOfBirth: string;
}

export interface AbhaVerifyRequest {
  txnId: string;
  otp: string;
}

export interface CareContextLinkRequest {
  abhaAddress: string;
  patientId: string;
  encounterId: string;
  careContextReference: string;
  display: string;
}

export interface IAbdmAdapter {
  generateAbha(data: AbhaGenerateRequest): Promise<{ txnId: string; otpSent: boolean; message: string }>;
  verifyOtp(data: AbhaVerifyRequest): Promise<{ verified: boolean; abhaNumber: string; abhaAddress: string; token: string }>;
  linkCareContext(data: CareContextLinkRequest): Promise<{ success: boolean; linkRefNumber: string; message: string }>;
  getStatus(): Promise<{ status: string; gateway: string; sandbox: boolean }>;
  isSimulator(): boolean;
}

export function areSimulatorsEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.DEV_SIMULATORS === 'true';
}

/**
 * ABDM Simulator / Sandbox Adapter.
 * Emulates the National Health Authority (NHA) ABDM M1, M2, and M3 APIs.
 */
export class AbdmSimulatorAdapter implements IAbdmAdapter {
  private activeTransactions: Map<string, { data: AbhaGenerateRequest; expectedOtp: string }> = new Map();
  private linkedContexts: Map<string, CareContextLinkRequest[]> = new Map();

  isSimulator(): boolean {
    return true;
  }

  async getStatus(): Promise<{ status: string; gateway: string; sandbox: boolean }> {
    return {
      status: areSimulatorsEnabled() ? 'ACTIVE_SIMULATOR' : 'SIMULATOR_DISABLED',
      gateway: 'NHA-ABDM-M1/M2/M3-GATEWAY',
      sandbox: true,
    };
  }

  async generateAbha(data: AbhaGenerateRequest): Promise<{ txnId: string; otpSent: boolean; message: string }> {
    if (!areSimulatorsEnabled()) {
      throw new Error('ABDM sandbox simulator is disabled in production or when DEV_SIMULATORS is not true');
    }
    const txnId = 'txn-' + crypto.randomBytes(8).toString('hex');
    // Simulated fixed OTP '123456' for predictable sandbox testing
    this.activeTransactions.set(txnId, { data, expectedOtp: '123456' });

    return {
      txnId,
      otpSent: true,
      message: 'OTP sent to registered mobile linked with Aadhaar/Mobile (Sandbox OTP: 123456)',
    };
  }

  async verifyOtp(data: AbhaVerifyRequest): Promise<{ verified: boolean; abhaNumber: string; abhaAddress: string; token: string }> {
    if (!areSimulatorsEnabled()) {
      throw new Error('ABDM sandbox simulator is disabled in production or when DEV_SIMULATORS is not true');
    }
    const txn = this.activeTransactions.get(data.txnId);
    if (!txn) {
      throw new Error('Transaction expired or invalid txnId');
    }

    if (data.otp !== txn.expectedOtp && data.otp !== '123456') {
      throw new Error('Invalid OTP provided. Please use sandbox OTP: 123456');
    }

    const cleanName = txn.data.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const randSuffix = crypto.randomInt(1000, 10000);
    const abhaNumber = `91-${crypto.randomInt(1000, 10000)}-${crypto.randomInt(1000, 10000)}-${randSuffix}`;
    const abhaAddress = `${cleanName}${randSuffix}@abdm`;
    const token = 'abdm-token-' + crypto.randomBytes(16).toString('hex');

    this.activeTransactions.delete(data.txnId);

    return {
      verified: true,
      abhaNumber,
      abhaAddress,
      token,
    };
  }

  async linkCareContext(data: CareContextLinkRequest): Promise<{ success: boolean; linkRefNumber: string; message: string }> {
    if (!areSimulatorsEnabled()) {
      throw new Error('ABDM sandbox simulator is disabled in production or when DEV_SIMULATORS is not true');
    }
    const linkRefNumber = 'link-' + crypto.randomBytes(8).toString('hex');
    const existing = this.linkedContexts.get(data.abhaAddress) || [];
    existing.push(data);
    this.linkedContexts.set(data.abhaAddress, existing);

    return {
      success: true,
      linkRefNumber,
      message: `Care context "${data.display}" successfully linked to ABHA ${data.abhaAddress}`,
    };
  }
}

export const abdmAdapter = new AbdmSimulatorAdapter();
