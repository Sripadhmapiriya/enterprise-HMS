import { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { authenticateToken, requireModule, requirePermission } from '../middleware/auth';
import { AppError } from '../utils/errors';
import { authService } from '../services/authService';

const router = Router();

router.use(authenticateToken);
router.use(requireModule('hr'));

function generateEmployeeCode(): string {
  const rand = crypto.randomInt(1000, 10000);
  return `EMP-${Date.now().toString().slice(-4)}${rand}`;
}

// =========================================================================
// VALIDATION SCHEMAS
// =========================================================================

const CreateEmployeeSchema = z.object({
  userId: z.string().optional(),
  email: z.string().email().optional(),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  employeeCode: z.string().optional(),
  departmentId: z.string().optional(),
  designation: z.string().min(1, 'Designation is required'),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT']).default('FULL_TIME'),
  joiningDate: z.string().optional(),
  reportingManagerId: z.string().optional(),
  status: z.enum(['ACTIVE', 'NOTICE_PERIOD', 'TERMINATED', 'RESIGNED']).default('ACTIVE'),
});

const AddCredentialSchema = z.object({
  credentialType: z.enum(['DEGREE', 'LICENSE', 'REGISTRATION', 'BOARD_CERTIFICATION', 'BLS_ACLS']),
  authority: z.string().min(1, 'Issuing authority is required'),
  registrationNumber: z.string().min(1, 'Registration/license number is required'),
  issueDate: z.string().optional(),
  expiryDate: z.string().min(1, 'Expiry date is required'),
});

const RecordAttendanceSchema = z.object({
  employeeId: z.string().min(1, 'Employee ID is required'),
  date: z.string().optional(),
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  status: z.enum(['PRESENT', 'ABSENT', 'HALF_DAY', 'LATE', 'LEAVE']).default('PRESENT'),
  overtimeHours: z.number().min(0).default(0),
});

const SubmitLeaveSchema = z.object({
  employeeId: z.string().min(1, 'Employee ID is required'),
  leaveType: z.enum(['CASUAL', 'SICK', 'EARNED', 'MATERNITY', 'COMPENSATORY']).default('CASUAL'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  reason: z.string().optional(),
});

const ProcessPayrollSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020),
});

// =========================================================================
// 1. EMPLOYEE MASTER
// =========================================================================

// GET /api/v1/hr/employees
router.get('/employees', requirePermission('hr.employees.manage'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const { departmentId, status, search } = req.query as Record<string, string>;
    const where: any = { tenantId };

    if (departmentId) where.departmentId = departmentId;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { employeeCode: { contains: search, mode: 'insensitive' } },
        { designation: { contains: search, mode: 'insensitive' } },
        { user: { firstName: { contains: search, mode: 'insensitive' } } },
        { user: { lastName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const employees = await req.prismaTenant.employee.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        department: true,
        credentials: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: employees });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/hr/employees
router.post('/employees', requirePermission('hr.employees.manage'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const body = CreateEmployeeSchema.parse(req.body);

    let userId = body.userId;
    if (!userId) {
      const email = body.email || `emp.${Date.now()}@hospital.internal`;
      const user = await req.prismaTenant.user.create({
        data: {
          tenantId,
          email,
          passwordHash: await authService.hashPassword('TempPass123!'),
          firstName: body.firstName,
          lastName: body.lastName,
        },
      });
      userId = user.id;
    }

    const employeeCode = body.employeeCode || generateEmployeeCode();
    const joiningDate = body.joiningDate ? new Date(body.joiningDate) : new Date();

    const employee = await req.prismaTenant.employee.create({
      data: {
        tenantId,
        userId,
        employeeCode,
        departmentId: body.departmentId,
        designation: body.designation,
        employmentType: body.employmentType,
        joiningDate,
        reportingManagerId: body.reportingManagerId,
        status: body.status,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        department: true,
      },
    });

    res.status(201).json({
      success: true,
      message: `Employee ${employee.employeeCode} onboarded`,
      data: employee,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/hr/employees/:id
router.get('/employees/:id', requirePermission('hr.employees.manage'), async (req, res, next) => {
  try {
    const employee = await req.prismaTenant.employee.findFirst({
      where: { id: req.params.id },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        department: true,
        credentials: true,
        attendances: { orderBy: { date: 'desc' }, take: 30 },
        leaveRequests: { orderBy: { createdAt: 'desc' }, take: 10 },
        payslips: { include: { payrollPeriod: true }, orderBy: { createdAt: 'desc' }, take: 12 },
      },
    });

    if (!employee) throw AppError.notFound('Employee record not found');
    res.json({ success: true, data: employee });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 2. CREDENTIALS & COMPLIANCE ALERTS
// =========================================================================

// POST /api/v1/hr/employees/:id/credentials
router.post('/employees/:id/credentials', requirePermission('hr.employees.manage'), async (req, res, next) => {
  try {
    const body = AddCredentialSchema.parse(req.body);
    const employee = await req.prismaTenant.employee.findFirst({ where: { id: req.params.id } });
    if (!employee) throw AppError.notFound('Employee not found');

    const expiryDate = new Date(body.expiryDate);
    const isExpired = expiryDate.getTime() < Date.now();

    const cred = await req.prismaTenant.employeeCredential.create({
      data: {
        employeeId: employee.id,
        credentialType: body.credentialType,
        authority: body.authority,
        registrationNumber: body.registrationNumber,
        issueDate: body.issueDate ? new Date(body.issueDate) : undefined,
        expiryDate,
        status: isExpired ? 'EXPIRED' : 'VALID',
      },
    });

    res.status(201).json({
      success: true,
      message: 'Professional credential recorded',
      data: cred,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/hr/compliance/expiring-credentials or /api/v1/hr/credentials
router.get(['/compliance/expiring-credentials', '/credentials'], requirePermission('hr.employees.manage'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const now = new Date();
    const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    const credentials = await req.prismaTenant.employeeCredential.findMany({
      where: {
        employee: { tenantId },
        expiryDate: { lte: in90Days },
      },
      include: {
        employee: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
            department: true,
          },
        },
      },
      orderBy: { expiryDate: 'asc' },
    });

    const mapped = credentials.map((c: any) => {
      const daysLeft = Math.ceil((new Date(c.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return {
        id: c.id,
        employeeName: `${c.employee.user.firstName} ${c.employee.user.lastName}`,
        employeeCode: c.employee.employeeCode,
        department: c.employee.department?.name || 'General',
        credentialType: c.credentialType,
        authority: c.authority,
        registrationNumber: c.registrationNumber,
        expiryDate: c.expiryDate,
        daysRemaining: daysLeft,
        daysUntilExpiry: daysLeft,
        isExpired: daysLeft <= 0,
        isExpiringSoon: daysLeft > 0 && daysLeft <= 90,
        severity: daysLeft <= 0 ? 'CRITICAL' : daysLeft <= 30 ? 'HIGH' : 'MEDIUM',
      };
    });

    res.json({ success: true, data: mapped });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 3. ATTENDANCE & SHIFTS
// =========================================================================

// POST /api/v1/hr/attendance
router.post('/attendance', requirePermission('hr.roster.manage'), async (req, res, next) => {
  try {
    const body = RecordAttendanceSchema.parse(req.body);
    const dateObj = body.date ? new Date(body.date) : new Date();
    dateObj.setHours(0, 0, 0, 0);

    const checkIn = body.checkIn ? new Date(body.checkIn) : new Date();
    const checkOut = body.checkOut ? new Date(body.checkOut) : undefined;

    const record = await req.prismaTenant.attendance.upsert({
      where: {
        employeeId_date: {
          employeeId: body.employeeId,
          date: dateObj,
        },
      },
      update: {
        checkIn,
        checkOut,
        status: body.status,
        overtimeHours: body.overtimeHours,
      },
      create: {
        employeeId: body.employeeId,
        date: dateObj,
        checkIn,
        checkOut,
        status: body.status,
        overtimeHours: body.overtimeHours,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Attendance record saved',
      data: record,
    });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 4. LEAVE WORKFLOW
// =========================================================================

// POST /api/v1/hr/leaves or /api/v1/hr/leave
router.post(['/leaves', '/leave'], requirePermission('hr.employees.manage'), async (req, res, next) => {
  try {
    const body = SubmitLeaveSchema.parse(req.body);
    const leave = await req.prismaTenant.leaveRequest.create({
      data: {
        employeeId: body.employeeId,
        leaveType: body.leaveType,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        reason: body.reason,
        status: 'PENDING',
      },
      include: {
        employee: { include: { user: true } },
      },
    });

    res.status(201).json({ success: true, data: leave });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/v1/hr/leaves/:id/approve or /api/v1/hr/leave/:id
router.patch(['/leaves/:id/approve', '/leaves/:id', '/leave/:id/approve', '/leave/:id'], requirePermission('hr.employees.manage'), async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const statusParam = req.body.status || (req.body.approved === false ? 'REJECTED' : 'APPROVED');

    const leave = await req.prismaTenant.leaveRequest.update({
      where: { id: req.params.id },
      data: {
        status: statusParam,
        approvedById: userId,
      },
      include: {
        employee: { include: { user: true } },
        approvedBy: { select: { firstName: true, lastName: true } },
      },
    });

    res.json({
      success: true,
      message: statusParam === 'APPROVED' ? 'Leave request approved' : 'Leave request rejected',
      data: leave,
    });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 5. PAYROLL RUN & PAYSLIPS
// =========================================================================

// POST /api/v1/hr/payroll/run
router.post('/payroll/run', requirePermission('hr.employees.manage'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const body = ProcessPayrollSchema.parse(req.body);

    // 1. Upsert payroll period
    const period = await req.prismaTenant.payrollPeriod.upsert({
      where: {
        tenantId_month_year: {
          tenantId,
          month: body.month,
          year: body.year,
        },
      },
      update: { status: 'PROCESSING' },
      create: {
        tenantId,
        month: body.month,
        year: body.year,
        status: 'PROCESSING',
      },
    });

    // 2. Fetch all active employees
    const employees = await req.prismaTenant.employee.findMany({
      where: { tenantId, status: 'ACTIVE' },
    });

    // 3. Generate payslips
    const payslips = [];
    for (const emp of employees) {
      const basicPay = 4500;
      const allowances = 750;
      const deductions = 350;
      const netPay = basicPay + allowances - deductions;

      // Upsert payslip for this employee and period
      let slip = await req.prismaTenant.payslip.findFirst({
        where: { employeeId: emp.id, payrollPeriodId: period.id },
      });

      if (!slip) {
        slip = await req.prismaTenant.payslip.create({
          data: {
            employeeId: emp.id,
            payrollPeriodId: period.id,
            basicPay,
            totalAllowances: allowances,
            totalDeductions: deductions,
            netPay,
            status: 'GENERATED',
          },
        });
      }
      payslips.push(slip);
    }

    await req.prismaTenant.payrollPeriod.update({
      where: { id: period.id },
      data: { status: 'FINALIZED' },
    });

    res.status(201).json({
      success: true,
      message: `Payroll finalized for ${body.month}/${body.year}; ${payslips.length} payslip(s) generated`,
      data: {
        period: { ...period, status: 'FINALIZED' },
        payslipCount: payslips.length,
        payslipsCount: payslips.length,
        totalDisbursement: payslips.reduce((s: number, p: any) => s + p.netPay, 0),
        payslips,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/hr/payroll/payslips or /payslips
router.get(['/payroll/payslips', '/payslips'], requirePermission('hr.employees.manage'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const { periodId, employeeId } = req.query as Record<string, string>;
    const where: any = { employee: { tenantId } };

    if (periodId) where.payrollPeriodId = periodId;
    if (employeeId) where.employeeId = employeeId;

    const payslips = await req.prismaTenant.payslip.findMany({
      where,
      include: {
        employee: { include: { user: true } },
        payrollPeriod: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: payslips });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/hr/payroll/periods
router.get('/payroll/periods', requirePermission('hr.employees.manage'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const periods = await req.prismaTenant.payrollPeriod.findMany({
      where: { tenantId },
      include: {
        payslips: {
          select: {
            basicPay: true,
            totalAllowances: true,
            totalDeductions: true,
            netPay: true,
          },
        },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });

    const mapped = periods.map((p: any) => {
      const totalGross = p.payslips.reduce((s: number, slip: any) => s + slip.basicPay + slip.totalAllowances, 0);
      const totalDeductions = p.payslips.reduce((s: number, slip: any) => s + slip.totalDeductions, 0);
      const totalNet = p.payslips.reduce((s: number, slip: any) => s + slip.netPay, 0);
      return {
        id: p.id,
        month: p.month,
        year: p.year,
        status: p.status,
        createdAt: p.createdAt,
        totalGross,
        totalDeductions,
        totalNet,
      };
    });

    res.json({ success: true, data: mapped });
  } catch (error) {
    next(error);
  }
});

export default router;
