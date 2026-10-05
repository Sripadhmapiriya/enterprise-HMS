#!/usr/bin/env tsx
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import argon2 from 'argon2';
import { prisma } from '@enterprise-hms/database';
import {
  EDITION_PRESETS,
  ModuleResolver,
  generateEd25519KeyPair,
  issueLicense,
  LicensePayload,
} from '@enterprise-hms/modules';

function parseArgs() {
  const args = process.argv.slice(2);
  const options: Record<string, string> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith('--')) {
        options[key] = nextArg;
        i++;
      } else {
        options[key] = 'true';
      }
    }
  }
  return options;
}

export async function provisionClient(options: {
  client: string;
  clientCode?: string;
  preset?: string;
  modules?: string[];
  adminEmail: string;
  adminName?: string;
  adminFirstName?: string;
  adminLastName?: string;
  adminPassword?: string;
  hospitalName?: string;
  branchName?: string;
  currency?: string;
  timezone?: string;
  brandColor?: string;
  keyPath?: string;
  outLicense?: string;
}) {
  const clientName = options.client;
  const clientCode = (
    options.clientCode || clientName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 10)
  );

  const resolver = new ModuleResolver();
  let requestedModules: string[] = [];

  if (options.preset) {
    const preset = EDITION_PRESETS[options.preset];
    if (!preset) {
      throw new Error(
        `Unknown preset "${options.preset}". Valid presets: ${Object.keys(EDITION_PRESETS).join(', ')}`
      );
    }
    requestedModules = preset.modules;
  } else if (options.modules && options.modules.length > 0) {
    requestedModules = options.modules;
  } else {
    requestedModules = EDITION_PRESETS['patients-only'].modules;
  }

  const { enabled: resolvedModules } = resolver.resolveDependencies(requestedModules);

  console.log(`\n========================================`);
  console.log(`Provisioning HMS Client: ${clientName} [${clientCode}]`);
  console.log(`Modules Enabled: ${resolvedModules.join(', ')}`);
  console.log(`========================================\n`);

  // 1. Find or create Tenant
  let tenant = await prisma.tenant.findFirst({
    where: { code: clientCode },
  });

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: clientName,
        code: clientCode,
        isActive: true,
      },
    });
    console.log(`✓ Created Tenant "${tenant.name}" (${tenant.id})`);
  } else {
    tenant = await prisma.tenant.update({
      where: { id: tenant.id },
      data: { name: clientName, isActive: true },
    });
    console.log(`✓ Updated existing Tenant "${tenant.name}" (${tenant.id})`);
  }

  // 2. Find or create Hospital
  const hospitalName = options.hospitalName || `${clientName} Medical Center`;
  let hospital = await prisma.hospital.findFirst({
    where: { tenantId: tenant.id, name: hospitalName },
  });

  if (!hospital) {
    hospital = await prisma.hospital.create({
      data: {
        tenantId: tenant.id,
        name: hospitalName,
        timezone: options.timezone || 'UTC',
        currency: options.currency || 'USD',
        isActive: true,
      },
    });
    console.log(`✓ Created Hospital "${hospital.name}" (${hospital.id})`);
  } else {
    hospital = await prisma.hospital.update({
      where: { id: hospital.id },
      data: { name: hospitalName, isActive: true },
    });
    console.log(`✓ Hospital verified "${hospital.name}" (${hospital.id})`);
  }

  // 3. Find or create Branch
  const branchName = options.branchName || 'Main Branch';
  const branchCode = `${clientCode}-B1`;
  let branch = await prisma.branch.findFirst({
    where: { hospitalId: hospital.id, code: branchCode },
  });

  if (!branch) {
    branch = await prisma.branch.create({
      data: {
        hospitalId: hospital.id,
        name: branchName,
        code: branchCode,
        isActive: true,
      },
    });
    console.log(`✓ Created Branch "${branch.name}" (${branch.id})`);
  } else {
    console.log(`✓ Branch verified "${branch.name}" (${branch.id})`);
  }

  // 4. Find or create default OPD Department
  let opdDept = await prisma.department.findFirst({
    where: { branchId: branch.id, code: 'OPD' },
  });

  if (!opdDept) {
    opdDept = await prisma.department.create({
      data: {
        branchId: branch.id,
        name: 'Outpatient Department',
        code: 'OPD',
        type: 'CLINICAL',
        isActive: true,
      },
    });
    console.log(`✓ Created Department "${opdDept.name}" (${opdDept.id})`);
  }

  // 5. Store Tenant Settings (Branding, timezone, currency, switches)
  const settingsToUpsert = [
    { key: 'brand_name', value: clientName },
    { key: 'brand_color', value: options.brandColor || '#0891b2' },
    { key: 'timezone', value: options.timezone || 'UTC' },
    { key: 'currency', value: options.currency || 'USD' },
    { key: 'require_billing_clearance', value: 'true' },
    { key: 'active_preset', value: options.preset || 'custom' },
  ];

  await Promise.all(
    settingsToUpsert.map((s) =>
      prisma.systemSetting.upsert({
        where: {
          tenantId_key: {
            tenantId: tenant.id,
            key: s.key,
          },
        },
        update: { value: s.value },
        create: {
          tenantId: tenant.id,
          key: s.key,
          value: s.value,
        },
      })
    )
  );
  console.log(`✓ Saved ${settingsToUpsert.length} Tenant settings and branding parameters`);

  // 6. Upsert Tenant Entitlements for ALL modules
  const allCatalogModules = resolver.getAllModules();
  const resolvedSet = new Set(resolvedModules);

  await Promise.all(
    allCatalogModules.map((mod) => {
      const isEnabled = resolvedSet.has(mod.id);
      return prisma.tenantEntitlement.upsert({
        where: {
          tenantId_moduleId: {
            tenantId: tenant.id,
            moduleId: mod.id,
          },
        },
        update: {
          enabled: isEnabled,
          limits: mod.limits ? (mod.limits as any) : undefined,
        },
        create: {
          tenantId: tenant.id,
          moduleId: mod.id,
          enabled: isEnabled,
          limits: mod.limits ? (mod.limits as any) : undefined,
        },
      });
    })
  );
  console.log(`✓ Configured runtime entitlements (${resolvedModules.length} enabled / ${allCatalogModules.length} total)`);

  // 7. Standard Role Templates
  const adminRole = await prisma.role.upsert({
    where: {
      tenantId_name: {
        tenantId: tenant.id,
        name: 'Hospital Admin',
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Hospital Admin',
      description: 'Full administrative access for hospital operations',
      isSystem: true,
    },
  });

  const doctorRole = await prisma.role.upsert({
    where: {
      tenantId_name: {
        tenantId: tenant.id,
        name: 'Doctor',
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Doctor',
      description: 'Clinical practitioner with OPD and prescription capabilities',
      isSystem: true,
    },
  });

  console.log(`✓ Verified standard role templates (Hospital Admin, Doctor)`);

  // 8. Provision First Admin User
  const adminEmail = options.adminEmail;
  const adminName = options.adminName || 'System Administrator';
  const nameParts = adminName.split(' ');
  const firstName = options.adminFirstName || nameParts[0] || 'System';
  const lastName = options.adminLastName || nameParts.slice(1).join(' ') || 'Admin';

  let adminUser = await prisma.user.findFirst({
    where: { email: adminEmail },
  });

  if (!adminUser) {
    const initialPassword = options.adminPassword || 'Admin@HMS2026!';
    const passwordHash = await argon2.hash(initialPassword);
    adminUser = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: adminEmail,
        passwordHash,
        firstName,
        lastName,
        isActive: true,
      },
    });
    console.log(`✓ Created primary administrator: ${adminUser.email}`);
  } else {
    const updateData: any = {
      tenantId: tenant.id,
      firstName,
      lastName,
      isActive: true,
    };
    if (options.adminPassword) {
      updateData.passwordHash = await argon2.hash(options.adminPassword);
    }
    adminUser = await prisma.user.update({
      where: { id: adminUser.id },
      data: updateData,
    });
    console.log(`✓ Admin user verified: ${adminUser.email}`);
  }

  // Link role
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: adminUser.id,
        roleId: adminRole.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: adminRole.id,
    },
  });

  // 9. Generate & Sign Ed25519 License
  let keypair: { publicKey: string; privateKey: string };
  if (options.keyPath && fs.existsSync(options.keyPath)) {
    const priv = fs.readFileSync(options.keyPath, 'utf8');
    const pubPath = `${options.keyPath}.pub`;
    const pub = fs.existsSync(pubPath) ? fs.readFileSync(pubPath, 'utf8') : '';
    keypair = { privateKey: priv, publicKey: pub };
  } else {
    keypair = generateEd25519KeyPair();
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

  const licensePayload: LicensePayload = {
    clientId: tenant.id,
    clientName,
    modules: resolvedModules,
    limits: {
      maxUsers: 250,
      maxBeds: 100,
      maxHospitals: 1,
    },
    issuedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    gracePeriodDays: 14,
  };

  const signedLicense = issueLicense(licensePayload, keypair.privateKey, keypair.publicKey);

  // Save license in SystemSetting
  await prisma.systemSetting.upsert({
    where: {
      tenantId_key: {
        tenantId: tenant.id,
        key: 'license_signed_json',
      },
    },
    update: { value: JSON.stringify(signedLicense) },
    create: {
      tenantId: tenant.id,
      key: 'license_signed_json',
      value: JSON.stringify(signedLicense),
    },
  });

  if (options.outLicense) {
    fs.mkdirSync(path.dirname(path.resolve(options.outLicense)), { recursive: true });
    fs.writeFileSync(options.outLicense, JSON.stringify(signedLicense, null, 2), 'utf8');
    console.log(`✓ Exported license file: ${options.outLicense}`);
  }

  console.log(`\n========================================`);
  console.log(`✓ PROVISIONING COMPLETE`);
  console.log(`Tenant ID:     ${tenant.id}`);
  console.log(`Hospital ID:   ${hospital.id}`);
  console.log(`Branch ID:     ${branch.id}`);
  console.log(`Admin Email:   ${adminUser.email}`);
  console.log(`License:       ${signedLicense.signature.slice(0, 32)}...`);
  console.log(`========================================\n`);

  return {
    tenant,
    hospital,
    branch,
    adminUser,
    signedLicense,
  };
}

export interface ProvisionTenantOptions {
  clientName: string;
  clientCode?: string;
  preset?: string;
  modules?: string[];
  adminEmail: string;
  adminFirstName?: string;
  adminLastName?: string;
  adminPassword?: string;
  hospitalName?: string;
  branchName?: string;
  currency?: string;
  timezone?: string;
  brandColor?: string;
  keyPath?: string;
  outLicense?: string;
}

export async function provisionTenant(options: ProvisionTenantOptions) {
  const adminName = [options.adminFirstName, options.adminLastName].filter(Boolean).join(' ') || undefined;
  const res = await provisionClient({
    ...options,
    client: options.clientName,
    adminName,
    adminFirstName: options.adminFirstName,
    adminLastName: options.adminLastName,
  });

  const entitlements = await prisma.tenantEntitlement.findMany({
    where: { tenantId: res.tenant.id, enabled: true },
  });

  return {
    tenant: res.tenant,
    hospital: res.hospital,
    branch: res.branch,
    adminUser: {
      ...res.adminUser,
      requiresPasswordChange: true,
    },
    entitlements,
    license: res.signedLicense,
  };
}

async function main() {
  const options = parseArgs();
  const client = options['client'] || 'Demo General Hospital';
  const adminEmail = options['admin-email'] || 'admin@demo-hospital.org';

  await provisionClient({
    client,
    clientCode: options['client-code'],
    preset: options['preset'],
    modules: options['modules'] ? options['modules'].split(',').map((m) => m.trim()) : undefined,
    adminEmail,
    adminName: options['admin-name'],
    adminPassword: options['admin-password'],
    hospitalName: options['hospital-name'],
    branchName: options['branch-name'],
    currency: options['currency'],
    timezone: options['timezone'],
    brandColor: options['brand-color'],
    keyPath: options['key-path'],
    outLicense: options['out-license'],
  });

  await prisma.$disconnect();
}

if (require.main === module || process.argv[1]?.includes('provision')) {
  main().catch((err) => {
    console.error('Provisioning failed:', err);
    prisma.$disconnect();
    process.exit(1);
  });
}
