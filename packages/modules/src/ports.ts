import {
  ChargeCapturePort,
  ChargeItem,
  NotificationMessage,
  NotificationPort,
  OrderingPort,
  OrderItem,
  PatientLookupPort,
  PatientSummary,
  ResultItem,
  ResultsPort,
} from './types';

export class StandaloneChargeCapturePort implements ChargeCapturePort {
  async postCharge(charge: ChargeItem): Promise<{
    success: boolean;
    billItemId?: string;
    receiptMode: 'INVOICE' | 'POS';
  }> {
    // When billing is absent, charges degrade gracefully to point-of-sale receipt
    return {
      success: true,
      receiptMode: 'POS',
    };
  }
}

export class StandaloneOrderingPort implements OrderingPort {
  async createOrder(order: OrderItem): Promise<{ success: boolean; orderId?: string }> {
    return {
      success: true,
      orderId: `order-local-\${Date.now()}`,
    };
  }
}

export class StandaloneResultsPort implements ResultsPort {
  async publishResult(result: ResultItem): Promise<{ success: boolean }> {
    return { success: true };
  }
}

export class StandaloneNotificationPort implements NotificationPort {
  async send(message: NotificationMessage): Promise<{ success: boolean; messageId?: string }> {
    return {
      success: true,
      messageId: `notif-local-\${Date.now()}`,
    };
  }
}

export class StandalonePatientLookupPort implements PatientLookupPort {
  private fallbackPatients: Map<string, PatientSummary> = new Map();

  setPatient(patient: PatientSummary) {
    this.fallbackPatients.set(patient.id, patient);
  }

  async getPatient(tenantId: string, patientId: string): Promise<PatientSummary | null> {
    return this.fallbackPatients.get(patientId) || null;
  }
}
