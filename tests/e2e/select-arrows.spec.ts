import { test, expect, request as playwrightRequest } from '@playwright/test';

let authToken = '';
let authTenantId = '';
let authUser: any = null;

test.beforeAll(async () => {
  const apiContext = await playwrightRequest.newContext();
  const res = await apiContext.post('http://localhost:4000/api/v1/auth/login', {
    data: {
      email: 'admin@demo.com',
      password: 'password123',
    },
  });

  const json = await res.json();
  if (json?.data?.accessToken) {
    authToken = json.data.accessToken;
    authTenantId = json.data.user.tenantId;
    authUser = json.data.user;
  }
});

async function setupAuthenticatedUser(page: any) {
  await page.addInitScript(
    ({ token, tenantId, user }: any) => {
      localStorage.setItem('hms_access_token', token);
      localStorage.setItem('hms_tenant_id', tenantId);
      localStorage.setItem('hms_user', JSON.stringify(user));
    },
    { token: authToken, tenantId: authTenantId, user: authUser }
  );
}

test.describe('Dropdown Arrows check', () => {
  const pagesToCheck = [
    '/dashboard',
    '/patients',
    '/appointments',
    '/billing'
  ];

  for (const pagePath of pagesToCheck) {
    test(`Checks all select elements on ${pagePath} for exact arrow count`, async ({ page }) => {
      await setupAuthenticatedUser(page);
      await page.goto(`http://localhost:3000${pagePath}`);
      await page.waitForLoadState('networkidle');

      // Find all select elements on the page
      const selects = page.locator('select');
      const count = await selects.count();

      for (let i = 0; i < count; i++) {
        const select = selects.nth(i);
        
        // 1. Ensure the native arrow is hidden via computed styles
        const appearance = await select.evaluate((el) => {
          const style = window.getComputedStyle(el);
          return style.getPropertyValue('appearance') || style.getPropertyValue('-webkit-appearance');
        });
        expect(['none']).toContain(appearance); // Safari or standard

        // 2. Ensure exactly one custom chevron down exists alongside it
        // The Select component structure: <div className="relative flex items-center"><select /><div><ChevronDown /></div></div>
        const parent = select.locator('xpath=..');
        const chevronIcon = parent.locator('svg.lucide-chevron-down');
        
        // It must have exactly one chevron icon
        expect(await chevronIcon.count()).toBe(1);
      }
    });
  }
});
