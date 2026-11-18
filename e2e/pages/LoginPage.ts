import { Page, Locator } from '@playwright/test';

export class LoginPage {
  readonly username: Locator;
  readonly password: Locator;
  readonly submit: Locator;
  readonly error: Locator;

  constructor(private readonly page: Page) {
    this.username = page.getByRole('textbox', { name: 'Username or Email' });
    this.password = page.getByLabel('Password', { exact: true });
    this.submit = page.getByRole('button', { name: 'Sign In' });
    this.error = page.getByRole('alert');
  }

  async goto() {
    await this.page.goto('/login');
  }

  async login(usernameOrEmail: string, password: string) {
    await this.username.fill(usernameOrEmail);
    await this.password.fill(password);
    await this.submit.click();
  }
}
