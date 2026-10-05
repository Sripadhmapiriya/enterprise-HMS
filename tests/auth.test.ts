import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from './apps/api/src/index';
import { prisma } from './packages/database/src/index';

describe('Workstream B: API Authentication & Security Hardening', () => {
  let validAccessToken: string;
  let validRefreshToken: string;
  const testEmail = 'doctor@demo.com';
  const testPassword = 'password123';

  beforeAll(async () => {
    // Ensure demo user exists in database for auth testing
    const tenant = await prisma.tenant.upsert({
      where: { code: 'DEMO-TENANT' },
      update: {},
      create: { name: 'Demo Organization', code: 'DEMO-TENANT' },
    });

    const user = await prisma.user.findUnique({ where: { email: testEmail } });
    if (!user) {
      // In case seed hasn't run yet, ensure test user exists
      const { authService } = await import('./apps/api/src/services/authService');
      const hash = await authService.hashPassword(testPassword);
      await prisma.user.create({
        data: {
          tenantId: tenant.id,
          email: testEmail,
          passwordHash: hash,
          firstName: 'Sarah',
          lastName: 'Connor',
        },
      });
    }
  });

  it('GET /health should return 200 with service info and X-Request-Id header', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('enterprise-hms-api');
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('POST /api/v1/auth/login should reject malformed payload with standard error envelope', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'invalid-email', password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.requestId).toBeDefined();
    expect(Array.isArray(res.body.error.details)).toBe(true);
  });

  it('POST /api/v1/auth/login should reject invalid credentials with 401 UNAUTHORIZED', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: testEmail, password: 'wrong-password-123' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('POST /api/v1/auth/login should successfully authenticate and issue access/refresh tokens', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: testEmail, password: testPassword });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    expect(res.body.data.expiresIn).toBe(900);
    expect(res.body.data.user.email).toBe(testEmail);
    expect(Array.isArray(res.body.data.enabledModules)).toBe(true);

    validAccessToken = res.body.data.accessToken;
    validRefreshToken = res.body.data.refreshToken;
  });

  it('GET /api/v1/auth/me should reject unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('GET /api/v1/auth/me should return current user details with valid Bearer token', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${validAccessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe(testEmail);
    expect(res.body.data.tenantId).toBeDefined();
  });

  it('GET /api/v1/auth/capabilities should return resolved modules, permissions and nav items', async () => {
    const res = await request(app)
      .get('/api/v1/auth/capabilities')
      .set('Authorization', `Bearer ${validAccessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.enabledModules)).toBe(true);
    expect(Array.isArray(res.body.data.nav)).toBe(true);
  });

  it('POST /api/v1/auth/refresh should rotate refresh token and issue new access token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: validRefreshToken });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    expect(res.body.data.refreshToken).not.toBe(validRefreshToken);

    validAccessToken = res.body.data.accessToken;
    validRefreshToken = res.body.data.refreshToken;
  });

  it('POST /api/v1/auth/logout should revoke active refresh session', async () => {
    const res = await request(app)
      .post('/api/v1/auth/logout')
      .send({ refreshToken: validRefreshToken });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Subsequent refresh using revoked token must fail
    const replayRes = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: validRefreshToken });

    expect(replayRes.status).toBe(401);
  });

  it('POST /api/v1/auth/login account lockout triggers after 5 consecutive failed attempts', async () => {
    const lockoutTarget = `lockout-test-${Date.now()}@example.com`;

    for (let i = 0; i < 4; i++) {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: lockoutTarget, password: 'wrong-password' });
      expect(res.status).toBe(401);
    }

    // 5th attempt must trigger account lockout (423)
    const fifthRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: lockoutTarget, password: 'wrong-password' });

    expect(fifthRes.status).toBe(423);
    expect(fifthRes.body.error.code).toBe('ACCOUNT_LOCKED');
  });
});
