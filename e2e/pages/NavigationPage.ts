import { Page, Locator } from '@playwright/test';

// Every sidebar item the app can show. Add new menu items here only; NavLabel follows.
export const NAV_LABELS = ['Dashboard', 'Inventory', 'Categories', 'Sales & Orders'] as const;
export type NavLabel = (typeof NAV_LABELS)[number];

export class NavigationPage {
  readonly nav: Locator;
  readonly signOut: Locator;

  constructor(private readonly page: Page) {
    this.nav = page.getByRole('navigation', { name: 'Role Navigation' });
    // Sign Out exists in both sidebar and header; use the sidebar one
    this.signOut = page.getByRole('complementary').getByRole('button', { name: 'Sign Out' });
  }

  link(label: NavLabel) {
    return this.nav.getByRole('link', { name: label });
  }

  async goTo(label: NavLabel) {
    await this.link(label).click();
  }

  // Open a URL directly, e.g. one outside the role (FR-AUTH-07)
  async gotoUrl(path: string) {
    await this.page.goto(path);
  }

  async logout() {
    await this.signOut.click();
  }
}
