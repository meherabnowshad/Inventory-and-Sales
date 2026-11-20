import { Page, Locator } from '@playwright/test';

// Shown when a role opens a URL outside its permissions (FR-AUTH-07).
export class NoAccessPage {
  readonly heading: Locator;
  readonly code: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Access Denied' });
    this.code = page.getByText('403 Forbidden');
  }
}
