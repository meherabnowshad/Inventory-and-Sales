import users from './users.json';

// Valid demo accounts share one password. Override with DEMO_PASSWORD in e2e/.env.
export const PASSWORD = process.env.DEMO_PASSWORD ?? 'Smart@1234';

export const USERS = users;

// Expected menu items and URLs that show "no access" per role (FR-AUTH-07, SRS Permission Matrix).
// Update this file when the SRS matrix changes.
export { default as PERMISSIONS } from './permissions.json';
