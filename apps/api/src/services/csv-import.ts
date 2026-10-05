import { z } from 'zod';

export type ImportDomain = 'patients' | 'items' | 'tariffs' | 'staff';

export interface ValidationErrorItem {
  row: number;
  field: string;
  value: string;
  message: string;
}

export interface ValidationReport {
  domain: ImportDomain;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: ValidationErrorItem[];
  validRecords: any[];
}

export interface ImportResult {
  report: ValidationReport;
  importedCount: number;
  dryRun: boolean;
  message: string;
}

// Domain Zod Schemas
export const PatientImportRowSchema = z.object({
  mrn: z.string().min(3, 'MRN must be at least 3 characters'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be YYYY-MM-DD'),
  mobile: z.string().min(7, 'Mobile must be at least 7 digits'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  bloodGroup: z.enum(['A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE', 'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE']).optional().or(z.literal('')),
});

export const ItemImportRowSchema = z.object({
  itemCode: z.string().min(2, 'Item code required'),
  name: z.string().min(2, 'Item name required'),
  category: z.string().min(1, 'Category is required'),
  unit: z.string().min(1, 'Unit is required'),
  unitPrice: z.coerce.number().positive('Unit price must be positive'),
  reorderLevel: z.coerce.number().int().nonnegative('Reorder level must be >= 0').optional().default(10),
});

export const TariffImportRowSchema = z.object({
  code: z.string().min(2, 'Tariff code required'),
  name: z.string().min(2, 'Tariff service name required'),
  department: z.string().min(2, 'Department name required'),
  standardRate: z.coerce.number().positive('Standard rate must be positive'),
  taxPercent: z.coerce.number().min(0).max(100).optional().default(0),
});

export const StaffImportRowSchema = z.object({
  employeeCode: z.string().min(2, 'Employee code required'),
  firstName: z.string().min(1, 'First name required'),
  lastName: z.string().min(1, 'Last name required'),
  email: z.string().email('Valid corporate email required'),
  role: z.string().min(2, 'Role name required'),
  department: z.string().min(2, 'Department required'),
  designation: z.string().optional().default('Staff Member'),
});

/**
 * Robust zero-dependency RFC 4180 CSV Parser
 */
export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && text[i + 1] === '\n') {
        i++;
      }
      if (current.trim().length > 0) {
        lines.push(current);
      }
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim().length > 0) {
    lines.push(current);
  }

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const parseLine = (line: string): string[] => {
    const fields: string[] = [];
    let field = '';
    let insideQuote = false;

    for (let j = 0; j < line.length; j++) {
      const c = line[j];
      if (c === '"') {
        if (insideQuote && line[j + 1] === '"') {
          field += '"';
          j++;
        } else {
          insideQuote = !insideQuote;
        }
      } else if (c === ',' && !insideQuote) {
        fields.push(field.trim());
        field = '';
      } else {
        field += c;
      }
    }
    fields.push(field.trim());
    return fields;
  };

  const headers = parseLine(lines[0]).map((h) => h.replace(/^["']|["']$/g, '').trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]).map((v) => v.replace(/^["']|["']$/g, '').trim());
    const rowObj: Record<string, string> = {};
    headers.forEach((hdr, idx) => {
      rowObj[hdr] = values[idx] ?? '';
    });
    rows.push(rowObj);
  }

  return { headers, rows };
}

export class CsvImportService {
  validateCsv(domain: ImportDomain, csvContent: string): ValidationReport {
    const { rows } = parseCsv(csvContent);
    const errors: ValidationErrorItem[] = [];
    const validRecords: any[] = [];

    const schema = this.getSchemaForDomain(domain);

    rows.forEach((row, idx) => {
      const rowNumber = idx + 2; // 1-indexed, header is row 1
      const result = schema.safeParse(row);

      if (!result.success) {
        for (const issue of result.error.issues) {
          const field = issue.path.join('.') || 'row';
          errors.push({
            row: rowNumber,
            field,
            value: String(row[field] ?? ''),
            message: issue.message,
          });
        }
      } else {
        validRecords.push(result.data);
      }
    });

    return {
      domain,
      totalRows: rows.length,
      validRows: validRecords.length,
      invalidRows: rows.length - validRecords.length,
      errors,
      validRecords,
    };
  }

  async commitImport(
    prisma: any,
    tenantId: string,
    hospitalId: string,
    domain: ImportDomain,
    records: any[]
  ): Promise<number> {
    let count = 0;

    switch (domain) {
      case 'patients':
        for (const r of records) {
          await prisma.patient.upsert({
            where: {
              mrn: r.mrn,
            },
            update: {
              firstName: r.firstName,
              lastName: r.lastName,
              gender: r.gender,
              dateOfBirth: new Date(r.dateOfBirth),
              mobile: r.mobile,
              email: r.email || null,
              bloodGroup: r.bloodGroup || null,
            },
            create: {
              tenantId,
              hospitalId,
              mrn: r.mrn,
              firstName: r.firstName,
              lastName: r.lastName,
              gender: r.gender,
              dateOfBirth: new Date(r.dateOfBirth),
              mobile: r.mobile,
              email: r.email || null,
              bloodGroup: r.bloodGroup || null,
            },
          });
          count++;
        }
        break;

      case 'items':
        // Ensure default category and unit exist
        let category = await prisma.productCategory.findFirst({ where: { tenantId } });
        if (!category) {
          category = await prisma.productCategory.create({
            data: { tenantId, name: 'General Supplies', code: 'GEN-SUP' },
          });
        }
        let unit = await prisma.unit.findFirst({ where: { tenantId } });
        if (!unit) {
          unit = await prisma.unit.create({
            data: { tenantId, name: 'Unit / Piece', code: 'PCS' },
          });
        }

        for (const r of records) {
          await prisma.product.upsert({
            where: {
              tenantId_code: {
                tenantId,
                code: r.itemCode,
              },
            },
            update: {
              name: r.name,
              purchasePrice: r.unitPrice,
              sellingPrice: r.unitPrice * 1.25,
            },
            create: {
              tenantId,
              code: r.itemCode,
              name: r.name,
              categoryId: category.id,
              unitId: unit.id,
              purchasePrice: r.unitPrice,
              sellingPrice: r.unitPrice * 1.25,
              reorderLevel: r.reorderLevel || 10,
            },
          });
          count++;
        }
        break;

      case 'tariffs':
        // Find or create default tariff
        let defaultTariff = await prisma.tariff.findFirst({ where: { tenantId } });
        if (!defaultTariff) {
          defaultTariff = await prisma.tariff.create({
            data: {
              tenantId,
              hospitalId,
              code: 'STD-TARIFF',
              name: 'Standard Hospital Tariff',
            },
          });
        }

        for (const r of records) {
          await prisma.tariffRate.upsert({
            where: {
              tariffId_serviceCode: {
                tariffId: defaultTariff.id,
                serviceCode: r.code,
              },
            },
            update: {
              rate: r.standardRate,
            },
            create: {
              tariffId: defaultTariff.id,
              serviceCode: r.code,
              serviceName: r.name,
              rate: r.standardRate,
            },
          });
          count++;
        }
        break;

      case 'staff':
        for (const r of records) {
          // Find or create user
          let user = await prisma.user.findFirst({ where: { tenantId, email: r.email } });
          if (!user) {
            user = await prisma.user.create({
              data: {
                tenantId,
                email: r.email,
                firstName: r.firstName,
                lastName: r.lastName,
                passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$simulatedHash$mock',
              },
            });
          }

          // Upsert employee
          await prisma.employee.upsert({
            where: { employeeCode: r.employeeCode },
            update: {
              designation: r.designation,
            },
            create: {
              tenantId,
              userId: user.id,
              employeeCode: r.employeeCode,
              employmentType: 'FULL_TIME',
              designation: r.designation,
              joiningDate: new Date(),
            },
          });
          count++;
        }
        break;
    }

    return count;
  }

  private getSchemaForDomain(domain: ImportDomain): z.ZodObject<any> {
    switch (domain) {
      case 'patients':
        return PatientImportRowSchema;
      case 'items':
        return ItemImportRowSchema;
      case 'tariffs':
        return TariffImportRowSchema;
      case 'staff':
        return StaffImportRowSchema;
      default:
        throw new Error(`Unsupported import domain: ${domain}`);
    }
  }
}

export const csvImportService = new CsvImportService();
