export interface BiometricPunchRecord {
  deviceId: string;
  employeeCode: string;
  punchTime: string;
  punchType: 'CHECK_IN' | 'CHECK_OUT';
  verificationMode: 'FINGERPRINT' | 'FACE' | 'RFID_CARD';
}

export class BiometricService {
  async processPunch(
    prisma: any,
    tenantId: string,
    punch: BiometricPunchRecord
  ): Promise<{ success: boolean; employeeId?: string; status: string }> {
    const employee = await prisma.employee.findFirst({
      where: { tenantId, employeeCode: punch.employeeCode },
    });

    if (!employee) {
      return {
        success: false,
        status: `Employee not found with code "${punch.employeeCode}"`,
      };
    }

    const punchDate = new Date(punch.punchTime);
    const dateStart = new Date(punchDate.getFullYear(), punchDate.getMonth(), punchDate.getDate());

    const existingAttendance = await prisma.attendance.findUnique({
      where: {
        employeeId_date: {
          employeeId: employee.id,
          date: dateStart,
        },
      },
    });

    if (punch.punchType === 'CHECK_IN') {
      if (!existingAttendance) {
        await prisma.attendance.create({
          data: {
            employeeId: employee.id,
            date: dateStart,
            checkIn: punchDate,
            status: 'PRESENT',
          },
        });
      }
    } else {
      if (existingAttendance) {
        await prisma.attendance.update({
          where: { id: existingAttendance.id },
          data: {
            checkOut: punchDate,
          },
        });
      } else {
        await prisma.attendance.create({
          data: {
            employeeId: employee.id,
            date: dateStart,
            checkOut: punchDate,
            status: 'PRESENT',
          },
        });
      }
    }

    return {
      success: true,
      employeeId: employee.id,
      status: `PUNCH_LOGGED_${punch.punchType}`,
    };
  }
}

export const biometricService = new BiometricService();
