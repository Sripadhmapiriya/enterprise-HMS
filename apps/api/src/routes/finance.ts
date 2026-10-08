import { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { authenticateToken, requireModule, requirePermission } from '../middleware/auth';
import { AppError } from '../utils/errors';

const router = Router();

router.use(authenticateToken);
router.use(requireModule('finance'));

function generateJournalNumber(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = crypto.randomInt(1000, 10000);
  return `JRN-${dateStr}-${rand}`;
}

// Default Standard Chart of Accounts seed
const DEFAULT_COA = [
  { accountCode: '1010', accountName: 'Cash on Hand & Bank Operations', accountType: 'ASSET' },
  { accountCode: '1100', accountName: 'Patient Accounts Receivable (AR)', accountType: 'ASSET' },
  { accountCode: '1200', accountName: 'Pharmacy & Medical Store Inventory', accountType: 'ASSET' },
  { accountCode: '1300', accountName: 'Biomedical & Capital Equipment', accountType: 'ASSET' },
  { accountCode: '2010', accountName: 'Trade Accounts Payable (AP / Suppliers)', accountType: 'LIABILITY' },
  { accountCode: '2100', accountName: 'Accrued Payroll & Statutory Liabilities', accountType: 'LIABILITY' },
  { accountCode: '3000', accountName: 'Hospital Retained Earnings & Equity', accountType: 'EQUITY' },
  { accountCode: '4010', accountName: 'Inpatient Clinical & Bed Revenue', accountType: 'REVENUE' },
  { accountCode: '4020', accountName: 'Outpatient Consultation & Clinic Revenue', accountType: 'REVENUE' },
  { accountCode: '4030', accountName: 'Pharmacy Sales Revenue', accountType: 'REVENUE' },
  { accountCode: '4040', accountName: 'Diagnostic Lab & Imaging Revenue', accountType: 'REVENUE' },
  { accountCode: '5010', accountName: 'Pharmaceutical & Medical Consumables Expense', accountType: 'EXPENSE' },
  { accountCode: '5020', accountName: 'Clinical & Nursing Staff Salaries', accountType: 'EXPENSE' },
  { accountCode: '5030', accountName: 'Equipment Maintenance & Biomedical AMC', accountType: 'EXPENSE' },
  { accountCode: '5040', accountName: 'Facility Housekeeping & Utilities Expense', accountType: 'EXPENSE' },
];

// =========================================================================
// VALIDATION SCHEMAS
// =========================================================================

const CreateAccountSchema = z.object({
  accountCode: z.string().min(1, 'Account code is required'),
  accountName: z.string().min(1, 'Account name is required'),
  accountType: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']),
  parentAccountId: z.string().optional(),
});

const JournalLineSchema = z.object({
  accountId: z.string().min(1, 'Account ID is required'),
  debit: z.number().min(0).default(0),
  credit: z.number().min(0).default(0),
  description: z.string().optional(),
});

const CreateJournalSchema = z.object({
  date: z.string().optional(),
  reference: z.string().optional(),
  description: z.string().min(1, 'Journal description is required'),
  lines: z
    .array(JournalLineSchema)
    .min(2, 'A double-entry journal requires at least two lines')
    .refine((lines) => {
      const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
      const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);
      return Math.abs(totalDebit - totalCredit) < 0.01;
    }, 'Unbalanced journal: total debits must equal total credits'),
});

// =========================================================================
// 1. CHART OF ACCOUNTS (COA)
// =========================================================================

// GET /api/v1/finance/accounts
router.get('/accounts', requirePermission('finance.ledger.view'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    let accounts = await req.prismaTenant.chartOfAccount.findMany({
      where: { tenantId },
      include: { children: true, parent: true },
      orderBy: { accountCode: 'asc' },
    });

    // Auto-seed default Chart of Accounts if empty for this tenant
    if (accounts.length === 0) {
      for (const item of DEFAULT_COA) {
        await req.prismaTenant.chartOfAccount.create({
          data: {
            tenantId,
            accountCode: item.accountCode,
            accountName: item.accountName,
            accountType: item.accountType,
            isActive: true,
          },
        });
      }
      accounts = await req.prismaTenant.chartOfAccount.findMany({
        where: { tenantId },
        include: { children: true, parent: true },
        orderBy: { accountCode: 'asc' },
      });
    }

    res.json({ success: true, data: accounts });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/finance/accounts
router.post('/accounts', requirePermission('finance.journals.post'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const body = CreateAccountSchema.parse(req.body);

    const existing = await req.prismaTenant.chartOfAccount.findUnique({
      where: { tenantId_accountCode: { tenantId, accountCode: body.accountCode } },
    });
    if (existing) {
      throw AppError.conflict(`Account code ${body.accountCode} already exists in Chart of Accounts`);
    }

    const account = await req.prismaTenant.chartOfAccount.create({
      data: {
        tenantId,
        accountCode: body.accountCode,
        accountName: body.accountName,
        accountType: body.accountType,
        parentAccountId: body.parentAccountId,
        isActive: true,
      },
    });

    res.status(201).json({
      success: true,
      message: `Account ${account.accountCode} - ${account.accountName} added to Chart of Accounts`,
      data: account,
    });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 2. DOUBLE-ENTRY JOURNALS & GENERAL LEDGER
// =========================================================================

// GET /api/v1/finance/journals
router.get('/journals', requirePermission('finance.ledger.view'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const journals = await req.prismaTenant.journal.findMany({
      where: { tenantId },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        lines: { include: { account: true } },
      },
      orderBy: { date: 'desc' },
      take: 100,
    });

    res.json({ success: true, data: journals });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/finance/journals
router.post('/journals', requirePermission('finance.journals.post'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.user!.userId;
    const body = CreateJournalSchema.parse(req.body);

    const journalNumber = generateJournalNumber();
    const dateObj = body.date ? new Date(body.date) : new Date();

    const totalDebit = body.lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = body.lines.reduce((s, l) => s + l.credit, 0);

    const journal = await req.prismaTenant.journal.create({
      data: {
        tenantId,
        journalNumber,
        date: dateObj,
        reference: body.reference,
        description: body.description,
        status: 'POSTED',
        createdById: userId,
        lines: {
          create: body.lines.map((l) => ({
            accountId: l.accountId,
            debit: l.debit,
            credit: l.credit,
            description: l.description,
          })),
        },
      },
      include: {
        lines: { include: { account: true } },
      },
    });

    res.status(201).json({
      success: true,
      message: `Double-entry journal ${journalNumber} posted (Debit: $${totalDebit.toFixed(2)}, Credit: $${totalCredit.toFixed(2)})`,
      data: journal,
    });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 3. TRIAL BALANCE & FINANCIAL STATEMENTS
// =========================================================================

// GET /api/v1/finance/trial-balance
router.get('/trial-balance', requirePermission('finance.ledger.view'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;

    // Ensure CoA exists
    let accounts = await req.prismaTenant.chartOfAccount.findMany({
      where: { tenantId, isActive: true },
      include: { journalLines: true },
      orderBy: { accountCode: 'asc' },
    });

    if (accounts.length === 0) {
      for (const item of DEFAULT_COA) {
        await req.prismaTenant.chartOfAccount.create({
          data: {
            tenantId,
            accountCode: item.accountCode,
            accountName: item.accountName,
            accountType: item.accountType,
            isActive: true,
          },
        });
      }
      accounts = await req.prismaTenant.chartOfAccount.findMany({
        where: { tenantId, isActive: true },
        include: { journalLines: true },
        orderBy: { accountCode: 'asc' },
      });
    }

    let grandTotalDebit = 0;
    let grandTotalCredit = 0;

    const rows = accounts.map((acc: any) => {
      const debitSum = acc.journalLines.reduce((s: number, l: any) => s + l.debit, 0);
      const creditSum = acc.journalLines.reduce((s: number, l: any) => s + l.credit, 0);

      grandTotalDebit += debitSum;
      grandTotalCredit += creditSum;

      // Net balance depends on normal account balance (Debit for Asset/Expense, Credit for Liability/Equity/Revenue)
      const isDebitNormal = acc.accountType === 'ASSET' || acc.accountType === 'EXPENSE';
      const netBalance = isDebitNormal ? debitSum - creditSum : creditSum - debitSum;

      return {
        accountId: acc.id,
        accountCode: acc.accountCode,
        accountName: acc.accountName,
        accountType: acc.accountType,
        totalDebit: debitSum,
        totalCredit: creditSum,
        netBalance,
      };
    });

    const isBalanced = Math.abs(grandTotalDebit - grandTotalCredit) < 0.01;

    res.json({
      success: true,
      data: {
        isBalanced,
        grandTotalDebit,
        grandTotalCredit,
        totalDebits: grandTotalDebit,
        totalCredits: grandTotalCredit,
        difference: Math.abs(grandTotalDebit - grandTotalCredit),
        accounts: rows,
      },
    });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 4. AP / AR AGING SUMMARY
// =========================================================================

// GET /api/v1/finance/ap-ar-summary or /api/v1/finance/aging-summary
router.get(['/ap-ar-summary', '/aging-summary'], requirePermission('finance.ledger.view'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;

    // Outstanding patient bills (AR)
    const pendingBills = await req.prismaTenant.bill.findMany({
      where: { tenantId, status: 'FINALIZED', outstandingAmount: { gt: 0 } },
      select: { outstandingAmount: true },
    });
    const totalAr = pendingBills.reduce((s: number, b: any) => s + b.outstandingAmount, 0);

    // Procurement goods receipts (AP)
    const grns = await req.prismaTenant.goodsReceipt.findMany({
      where: { tenantId },
      select: { totalAmount: true },
    });
    const totalAp = grns.reduce((s: number, g: any) => s + g.totalAmount, 0);

    res.json({
      success: true,
      data: {
        accountsReceivable: {
          total: totalAr,
          invoiceCount: pendingBills.length,
        },
        accountsPayable: {
          total: totalAp,
          receiptCount: grns.length,
        },
        ar: {
          total: totalAr,
          current: totalAr,
          days30to60: 0,
          days61to90: 0,
          over90: 0,
        },
        ap: {
          total: totalAp,
          current: totalAp,
          days30to60: 0,
          days61to90: 0,
          over90: 0,
        },
        totalOutstandingAR: totalAr,
        totalOutstandingAP: totalAp,
        netWorkingCapital: totalAr - totalAp,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
