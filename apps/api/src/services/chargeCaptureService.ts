import { prisma } from '@enterprise-hms/database';
import { entitlementService } from './entitlementService';
import { StandaloneChargeCapturePort } from '@enterprise-hms/modules';

export interface PostChargeInput {
  tenantId: string;
  hospitalId: string;
  branchId: string;
  patientId: string;
  encounterId?: string;
  chargeCode: string;
  description: string;
  quantity: number;
  unitPrice: number;
  sourceModule: 'PHARMACY' | 'EMERGENCY' | 'OPD' | 'LAB' | 'RADIOLOGY' | 'IPD';
  sourceReferenceId?: string;
  createdById: string;
}

export interface ChargeCaptureResult {
  success: boolean;
  receiptMode: 'INVOICE' | 'POS';
  billId?: string;
  billItemId?: string;
  amount: number;
  isBilled: boolean;
}

export class ChargeCaptureService {
  private fallbackPort = new StandaloneChargeCapturePort();

  /**
   * Posts a billable charge from any clinical module.
   * If billing module is enabled for the tenant:
   *   - Automatically creates or updates an open Bill and creates a BillItem.
   * If billing module is disabled:
   *   - Gracefully falls back to POS/standalone capture without blocking clinical workflows.
   */
  async postCharge(input: PostChargeInput): Promise<ChargeCaptureResult> {
    const isBillingEnabled = await entitlementService.isModuleEnabled(input.tenantId, 'billing');

    const totalAmount = input.quantity * input.unitPrice;

    if (!isBillingEnabled) {
      // Billing module is disabled - degrade gracefully to standalone POS
      await this.fallbackPort.postCharge({
        patientId: input.patientId,
        encounterId: input.encounterId,
        chargeCode: input.chargeCode,
        description: input.description,
        quantity: input.quantity,
        unitPrice: input.unitPrice,
        sourceModule: input.sourceModule,
        sourceReferenceId: input.sourceReferenceId,
      });

      return {
        success: true,
        receiptMode: 'POS',
        amount: totalAmount,
        isBilled: false,
      };
    }

    // Billing module IS enabled - flow charges into Bill and BillItem
    let bill = input.encounterId
      ? await prisma.bill.findFirst({
          where: {
            tenantId: input.tenantId,
            encounterId: input.encounterId,
            status: { in: ['DRAFT', 'PARTIALLY_PAID'] },
          },
        })
      : null;

    if (!bill) {
      bill = await prisma.bill.findFirst({
        where: {
          tenantId: input.tenantId,
          patientId: input.patientId,
          status: 'DRAFT',
        },
      });
    }

    if (!bill) {
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      const billCount = await prisma.bill.count({ where: { tenantId: input.tenantId } });
      const billNumber = `INV-${dateStr}-${String(billCount + 1).padStart(4, '0')}`;

      bill = await prisma.bill.create({
        data: {
          tenantId: input.tenantId,
          hospitalId: input.hospitalId,
          branchId: input.branchId,
          patientId: input.patientId,
          encounterId: input.encounterId || null,
          billNumber,
          billType: input.sourceModule === 'PHARMACY' ? 'PHARMACY' : 'OPD',
          status: 'DRAFT',
          subTotal: 0,
          grossTotal: 0,
          patientPayable: 0,
          outstandingAmount: 0,
          createdById: input.createdById,
        },
      });
    }

    // Find or create ChargeMaster item
    let chargeMaster = await prisma.chargeMaster.findFirst({
      where: { code: input.chargeCode },
    });

    if (!chargeMaster) {
      try {
        chargeMaster = await prisma.chargeMaster.create({
          data: {
            tenantId: input.tenantId,
            code: input.chargeCode,
            name: input.description,
            category: input.sourceModule,
            isBillable: true,
          },
        });
      } catch {
        chargeMaster = (await prisma.chargeMaster.findFirst({
          where: { code: input.chargeCode },
        }))!;
      }
    }

    // Create BillItem
    const billItem = await prisma.billItem.create({
      data: {
        billId: bill.id,
        chargeMasterId: chargeMaster.id,
        serviceName: input.description,
        quantity: input.quantity,
        unitPrice: input.unitPrice,
        lineTotal: totalAmount,
        sourceModule: input.sourceModule,
        sourceRefId: input.sourceReferenceId || null,
      },
    });

    // Update Bill Totals
    await prisma.bill.update({
      where: { id: bill.id },
      data: {
        subTotal: { increment: totalAmount },
        grossTotal: { increment: totalAmount },
        patientPayable: { increment: totalAmount },
        outstandingAmount: { increment: totalAmount },
      },
    });

    return {
      success: true,
      receiptMode: 'INVOICE',
      billId: bill.id,
      billItemId: billItem.id,
      amount: totalAmount,
      isBilled: true,
    };
  }
}

export const chargeCaptureService = new ChargeCaptureService();
