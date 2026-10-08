import crypto from 'crypto';

export interface CreateOrderRequest {
  tenantId: string;
  invoiceId: string;
  amount: number;
  currency: string;
  patientEmail?: string;
  patientPhone?: string;
}

export interface VerifyPaymentRequest {
  orderId: string;
  paymentId: string;
  signature: string;
}

export interface IPaymentGateway {
  createOrder(data: CreateOrderRequest): Promise<{ orderId: string; amount: number; currency: string; gateway: string }>;
  verifyPayment(data: VerifyPaymentRequest): Promise<{ verified: boolean; transactionId: string; status: string }>;
  isSimulator(): boolean;
}

export function areSimulatorsEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.DEV_SIMULATORS === 'true';
}

export class PaymentGatewaySimulator implements IPaymentGateway {
  private orders: Map<string, CreateOrderRequest> = new Map();

  isSimulator(): boolean {
    return true;
  }

  async createOrder(data: CreateOrderRequest): Promise<{ orderId: string; amount: number; currency: string; gateway: string }> {
    if (!areSimulatorsEnabled()) {
      throw new Error('Payment gateway simulator is disabled in production or when DEV_SIMULATORS is not true');
    }
    const orderId = 'order_' + crypto.randomBytes(8).toString('hex');
    this.orders.set(orderId, data);

    return {
      orderId,
      amount: data.amount,
      currency: data.currency || 'USD',
      gateway: 'RAZORPAY_STRIPE_SIMULATOR',
    };
  }

  async verifyPayment(data: VerifyPaymentRequest): Promise<{ verified: boolean; transactionId: string; status: string }> {
    if (!areSimulatorsEnabled()) {
      throw new Error('Payment gateway simulator is disabled in production or when DEV_SIMULATORS is not true');
    }
    // In simulator mode, accepts any signature or test string
    const txnId = 'txn_' + (data.paymentId || crypto.randomBytes(8).toString('hex'));

    return {
      verified: true,
      transactionId: txnId,
      status: 'CAPTURED',
    };
  }
}

export const paymentGateway = new PaymentGatewaySimulator();
