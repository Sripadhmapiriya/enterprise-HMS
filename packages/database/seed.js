"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const crypto_1 = __importDefault(require("crypto"));
const prisma = new client_1.PrismaClient();
async function hashPassword(password) {
    return new Promise((resolve, reject) => {
        const salt = crypto_1.default.randomBytes(16).toString('hex');
        crypto_1.default.scrypt(password, salt, 64, (err, derivedKey) => {
            if (err)
                reject(err);
            resolve(salt + ":" + derivedKey.toString('hex'));
        });
    });
}
async function main() {
    console.log("Seeding database...");
    // 1. Create permissions
    const permissions = [
        { category: "PATIENT", action: "patient.view" },
        { category: "PATIENT", action: "patient.create" },
        { category: "PATIENT", action: "patient.update" },
        { category: "HOSPITAL", action: "hospital.view" },
        { category: "HOSPITAL", action: "hospital.update" },
        { category: "USER", action: "user.view" },
        { category: "USER", action: "user.create" },
        { category: "USER", action: "user.update" },
        { category: "ROLE", action: "role.view" },
        { category: "ROLE", action: "role.update" },
        { category: "SETTINGS", action: "settings.view" },
        { category: "SETTINGS", action: "settings.update" },
    ];
    for (const p of permissions) {
        await prisma.permission.upsert({
            where: { category_action: { category: p.category, action: p.action } },
            update: {},
            create: p,
        });
    }
    // 2. Create Tenant
    const tenant = await prisma.tenant.upsert({
        where: { code: 'DEMO-TENANT' },
        update: {},
        create: {
            name: 'Demo Healthcare Organization',
            code: 'DEMO-TENANT',
        }
    });
    // 3. Create System Admin Role for this tenant
    const adminRole = await prisma.role.upsert({
        where: { tenantId_name: { tenantId: tenant.id, name: 'System Administrator' } },
        update: {},
        create: {
            tenantId: tenant.id,
            name: 'System Administrator',
            description: 'Full access to the entire system',
            isSystem: true
        }
    });
    const allPerms = await prisma.permission.findMany();
    for (const p of allPerms) {
        await prisma.rolePermission.upsert({
            where: { roleId_permissionId: { roleId: adminRole.id, permissionId: p.id } },
            update: {},
            create: { roleId: adminRole.id, permissionId: p.id }
        });
    }
    // 4. Create Hospital
    const hospital = await prisma.hospital.create({
        data: {
            tenantId: tenant.id,
            name: 'City General Hospital',
            legalName: 'City General Hospital LLC',
            city: 'Metropolis',
            timezone: 'UTC',
            currency: 'USD'
        }
    });
    // 5. Create Branch
    const branch = await prisma.branch.create({
        data: {
            hospitalId: hospital.id,
            name: 'Main Branch',
            code: 'MAIN-01',
            address: '123 Health Ave'
        }
    });
    // 6. Create Departments
    const cardiology = await prisma.department.create({
        data: {
            branchId: branch.id,
            name: 'Cardiology',
            code: 'CARD',
            type: 'Clinical'
        }
    });
    const admin = await prisma.department.create({
        data: {
            branchId: branch.id,
            name: 'Administration',
            code: 'ADMIN',
            type: 'Administrative'
        }
    });
    // 7. Create Admin User
    const passwordHash = await hashPassword('password123');
    const adminUser = await prisma.user.upsert({
        where: { email: 'admin@demo.com' },
        update: {},
        create: {
            tenantId: tenant.id,
            email: 'admin@demo.com',
            passwordHash,
            firstName: 'System',
            lastName: 'Admin'
        }
    });
    // Assign Role
    await prisma.userRole.upsert({
        where: { userId_roleId: { userId: adminUser.id, roleId: adminRole.id } },
        update: {},
        create: { userId: adminUser.id, roleId: adminRole.id }
    });
    console.log("Database seeded successfully!");
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
