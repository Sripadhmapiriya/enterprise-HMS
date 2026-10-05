export interface ParsedHl7Message {
  messageType: string;
  triggerEvent: string;
  messageControlId: string;
  timestamp: string;
  patient?: {
    id: string;
    mrn: string;
    lastName: string;
    firstName: string;
    dob: string;
    gender: string;
  };
  visit?: {
    patientClass: string;
    assignedLocation: string;
    attendingDoctor: string;
  };
  observations?: Array<{
    setNumber: string;
    testCode: string;
    testName: string;
    value: string;
    units: string;
    referenceRange: string;
    abnormalFlag: string;
  }>;
}

export class Hl7V2Service {
  /**
   * Parse an HL7 v2 pipe-delimited message string.
   */
  parseMessage(hl7Raw: string): ParsedHl7Message {
    const lines = hl7Raw.split(/[\r\n]+/).map((l) => l.trim()).filter((l) => l.length > 0);
    const result: ParsedHl7Message = {
      messageType: 'UNKNOWN',
      triggerEvent: 'UNKNOWN',
      messageControlId: '',
      timestamp: new Date().toISOString(),
      observations: [],
    };

    for (const line of lines) {
      const fields = line.split('|');
      const segment = fields[0];

      if (segment === 'MSH') {
        const msgTypeField = fields[8] || '';
        const [type, event] = msgTypeField.split('^');
        result.messageType = type || 'ADT';
        result.triggerEvent = event || 'A01';
        result.messageControlId = fields[9] || 'MSG-1';
        result.timestamp = fields[6] || new Date().toISOString();
      } else if (segment === 'PID') {
        const names = (fields[5] || '').split('^');
        result.patient = {
          id: fields[2] || '',
          mrn: fields[3] || fields[2] || '',
          lastName: names[0] || '',
          firstName: names[1] || '',
          dob: fields[7] || '',
          gender: fields[8] || '',
        };
      } else if (segment === 'PV1') {
        result.visit = {
          patientClass: fields[2] || 'I',
          assignedLocation: fields[3] || '',
          attendingDoctor: fields[7] || '',
        };
      } else if (segment === 'OBX') {
        const testCodeParts = (fields[3] || '').split('^');
        result.observations?.push({
          setNumber: fields[1] || '',
          testCode: testCodeParts[0] || '',
          testName: testCodeParts[1] || testCodeParts[0] || '',
          value: fields[5] || '',
          units: fields[6] || '',
          referenceRange: fields[7] || '',
          abnormalFlag: fields[8] || 'N',
        });
      }
    }

    return result;
  }

  /**
   * Generates an ADT^A01 (Admission) HL7 v2 formatted message.
   */
  generateAdtA01(data: {
    mrn: string;
    firstName: string;
    lastName: string;
    gender: string;
    dob: string;
    ward: string;
    bed: string;
    doctor: string;
  }): string {
    const ts = new Date().toISOString().replace(/[-:T.Z]/g, '').substring(0, 14);
    const msgId = 'ADT' + Date.now();

    const msh = `MSH|^~\\&|ENTERPRISE_HMS|HOSPITAL_A|EXTERNAL_SYS|RECEIVER|${ts}||ADT^A01|${msgId}|P|2.5`;
    const pid = `PID|1||${data.mrn}^^^ENTERPRISE_HMS||${data.lastName}^${data.firstName}||${data.dob.replace(/-/g, '')}|${data.gender.substring(0, 1)}`;
    const pv1 = `PV1|1|I|${data.ward}^${data.bed}||||${data.doctor}^MD`;

    return [msh, pid, pv1].join('\r');
  }
}

export const hl7Service = new Hl7V2Service();
