import { test, expect, type Page } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { NavigationPage, NAV_LABELS } from '../pages/NavigationPage';
import { NoAccessPage } from '../pages/NoAccessPage';
import { USERS, PASSWORD, PERMISSIONS } from '../fixtures/users';

const ROLES = [USERS.admin, USERS.sales, USERS.store];

type RoleUser = (typeof ROLES)[number];

async function loginAs(page: Page, user: RoleUser) {
  const login = new LoginPage(page);
  await login.goto();
  await login.login(user.username, PASSWORD);
  await expect(page).toHaveURL(user.homePath);
}

function permissionsOf(user: RoleUser) {
  return PERMISSIONS[user.role as keyof typeof PERMISSIONS];
}

test.describe('Login smoke', { tag: '@smoke' }, () => {
  // FR-AUTH-01: valid login opens the role's home screen
  for (const user of ROLES) {
    test(`${user.role} lands on the home screen after login`, async ({ page }) => {
      await loginAs(page, user);
      await expect(new NavigationPage(page).nav).toBeVisible();
    });
  }

  // FR-AUTH-01: a wrong login shows one generic error that names no field
  test('unknown user sees a generic error and stays on login', async ({ page }) => {
    const login = new LoginPage(page);
    const { username, password } = USERS.invalid.unknownUser;

    await login.goto();
    await login.login(username, password);

    await expect(login.error).toBeVisible();
    await expect(login.error).toContainText('Invalid username or password');
    await expect(page).toHaveURL(/\/login/);
  });

  // FR-AUTH-07: items outside the role are hidden
  for (const user of ROLES) {
    test(`${user.role} sees only the menu items of the role`, async ({ page }) => {
      await loginAs(page, user);
      const nav = new NavigationPage(page);
      const { menu } = permissionsOf(user);

      for (const label of NAV_LABELS) {
        if (menu.includes(label)) {
          await expect(nav.link(label)).toBeVisible();
        } else {
          await expect(nav.link(label)).toHaveCount(0);
        }
      }
    });
  }

  // FR-AUTH-07: opening such a URL directly shows the "no access" page
  for (const user of ROLES) {
    for (const path of permissionsOf(user).blocked) {
      test(`${user.role} opening ${path} directly sees no access`, async ({ page }) => {
        await loginAs(page, user);
        await new NavigationPage(page).gotoUrl(path);

        const noAccess = new NoAccessPage(page);
        await expect(noAccess.heading).toBeVisible();
        await expect(noAccess.code).toBeVisible();
      });
    }
  }

  // FR-AUTH-02: sign out returns to the login page
  test('user can sign out and returns to the login page', async ({ page }) => {
    await loginAs(page, USERS.admin);
    await new NavigationPage(page).logout();
    await expect(page).toHaveURL(/\/login/);
  });
});
// QA check: trivial change
