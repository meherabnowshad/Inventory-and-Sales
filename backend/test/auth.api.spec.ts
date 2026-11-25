import 'reflect-metadata';
import { createHash, createHmac } from 'crypto';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { Algorithm, hash } from '@node-rs/argon2';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/auth/auth.service';

// Auth API tests (IMS-05.6 | FR-AUTH-01 to 05, NFR-SEC-01, NFR-SEC-05).
// Every test that logs in, locks or deactivates uses a throwaway user whose username starts with
// "qa_auth_". The users are created in beforeAll and deleted in afterAll, so the seeded users and
// the other API test files are not affected. Test names carry the case ID from the test workbook
// (sheet "Auth API (Sprint 2)", for example TC-API-009).
vi.setConfig({ testTimeout: 30_000, hookTimeout: 60_000 });

const PASSWORD = 'Smart@1234';
const PREFIX = 'qa_auth_';
const RUN = Date.now().toString(36);
const GENERIC_ERROR = 'Invalid username or password';
const PROTECTED_ROUTES = ['/api/auth/me', '/api/categories', '/api/inventory', '/api/sales'];

interface AuthBody {
  user: { id: number; name: string; username: string; email: string; role: string };
  accessToken: string;
  token: string;
}

interface AuthSession extends AuthBody {
  refreshCookie: string;
  refreshToken: string;
}

describe('Auth API (IMS-05.6 | FR-AUTH-01 to 05, NFR-SEC-01)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authService: AuthService;
  let passwordHash: string;
  let roleId: number;
  const users: Record<string, { id: bigint; username: string; email: string }> = {};

  const http = () => request(app.getHttpServer());
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
  const base64url = (value: string | object) =>
    Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');
  const decodePayload = (token: string) =>
    JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));

  const login = (identifier: string, password: string = PASSWORD) =>
    http().post('/api/auth/login').send({ usernameOrEmail: identifier, password });

  const getRefreshCookie = (res: { headers: Record<string, string | string[] | undefined> }) => {
    const cookies = res.headers['set-cookie'];
    const refreshCookie = (Array.isArray(cookies) ? cookies : [cookies]).find((cookie) =>
      cookie?.startsWith('refreshToken='),
    );
    if (!refreshCookie) throw new Error('Login or refresh response did not set a refresh cookie');
    return refreshCookie;
  };

  const getRefreshToken = (cookie: string) => {
    const pair = cookie.split(';', 1)[0];
    if (!pair.startsWith('refreshToken=')) throw new Error('Invalid refresh cookie');
    return decodeURIComponent(pair.slice('refreshToken='.length));
  };

  const cookiePair = (cookie: string) => cookie.split(';', 1)[0];

  const loginAs = async (label: string): Promise<AuthSession> => {
    const res = await login(users[label].username);
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty('refreshToken');
    const refreshCookie = getRefreshCookie(res);
    return {
      ...(res.body as AuthBody),
      refreshCookie: cookiePair(refreshCookie),
      refreshToken: getRefreshToken(refreshCookie),
    };
  };

  const me = (token: string) => http().get('/api/auth/me').set('Authorization', `Bearer ${token}`);

  const refresh = (refreshToken: string) =>
    http()
      .post('/api/auth/refresh')
      .set('Cookie', `refreshToken=${encodeURIComponent(refreshToken)}`);

  const logoutWithCookie = (cookie: string) =>
    http().post('/api/auth/logout').set('Cookie', cookiePair(cookie));

  const createUser = async (label: string, isActive = true) => {
    const username = `${PREFIX}${RUN}_${label}`;
    const email = `${username}@smartmart.test`;
    const user = await prisma.user.create({
      data: { name: `QA Auth ${label}`, username, email, passwordHash, roleId, isActive },
    });
    users[label] = { id: user.id, username, email };
  };

  const removeTestUsers = async () => {
    const found = await prisma.user.findMany({
      where: { username: { startsWith: PREFIX } },
      select: { id: true },
    });
    const ids = found.map((u) => u.id);
    if (ids.length === 0) return;
    await prisma.refreshToken.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  };

  const throttleState = (label: string) =>
    prisma.user.findUniqueOrThrow({
      where: { id: users[label].id },
      select: { failedLogins: true, firstFailedAt: true, lockedUntil: true },
    });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
    authService = app.get(AuthService);
    passwordHash = await hash(PASSWORD, { algorithm: Algorithm.Argon2id });

    const role = await prisma.role.findUnique({ where: { name: 'Sales Staff' } });
    if (!role) throw new Error('Role "Sales Staff" not found: run npm run db:seed first');
    roleId = role.id;

    await removeTestUsers(); // leftovers of an earlier run that stopped half way
    for (const label of ['main', 'other', 'generic', 'deact', 'lock1', 'lock2', 'lock3']) {
      await createUser(label);
    }
    await createUser('inactive', false);
  });

  afterAll(async () => {
    if (app) {
      if (prisma) await removeTestUsers();
      await app.close();
    }
  });

  describe('Login (IMS-05.1 | FR-AUTH-01, FR-AUTH-04)', () => {
    it('TC-API-001: each seeded role logs in with username and password', async () => {
      const expected = [
        { username: 'sadia', role: 'Administrator' },
        { username: 'rafi', role: 'Sales Staff' },
        { username: 'mitu', role: 'Store Staff' },
      ];
      for (const { username, role } of expected) {
        const res = await login(username);
        expect(res.status).toBe(200);
        expect(res.body.user.role).toBe(role);
      }
    });

    it('TC-API-008: returns the access token in JSON and the refresh token only in an HttpOnly cookie', async () => {
      const res = await login(users.main.username);
      const refreshCookie = getRefreshCookie(res);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body.user).toMatchObject({
        username: users.main.username,
        email: users.main.email,
        role: 'Sales Staff',
      });
      expect(res.body.accessToken.split('.')).toHaveLength(3);
      expect(res.body).not.toHaveProperty('refreshToken');
      expect(refreshCookie).toMatch(/^refreshToken=smartmart_refresh_/);
      expect(refreshCookie).toMatch(/;\s*Path=\/api\/auth/i);
      expect(refreshCookie).toMatch(/;\s*HttpOnly/i);
      expect(res.body.token).toBe(res.body.accessToken);
    });

    it('TC-API-002 and 003: username and email are case-insensitive', async () => {
      expect((await login(users.main.username.toUpperCase())).status).toBe(200);
      expect((await login(users.main.email.toUpperCase())).status).toBe(200);
    });

    it('TC-API-004: spaces around the username are trimmed', async () => {
      const res = await login(`  ${users.main.username}  `);
      expect(res.status).toBe(200);
      expect(res.body.user.username).toBe(users.main.username);
    });

    it('TC-API-006: two logins of the same user work independently', async () => {
      const first = await loginAs('main');
      const second = await loginAs('main');

      expect(first.accessToken).not.toBe(second.accessToken);
      expect(first.refreshToken).not.toBe(second.refreshToken);
      expect((await me(first.accessToken)).status).toBe(200);
      expect((await me(second.accessToken)).status).toBe(200);
    });

    it('TC-API-007: the login and /auth/me responses contain no password or hash', async () => {
      const body = await loginAs('main');
      const profile = await me(body.accessToken);

      for (const text of [JSON.stringify(body), JSON.stringify(profile.body)]) {
        expect(text.toLowerCase()).not.toContain('password');
        expect(text.toLowerCase()).not.toContain('argon2');
      }
    });

    it('TC-API-009, 010, 011 and 019: wrong password, unknown user, short password and a trailing space return the same generic 401', async () => {
      const attempts = [
        { usernameOrEmail: users.generic.username, password: 'WrongPass#1' },
        { usernameOrEmail: `nobody_${RUN}`, password: 'WrongPass#1' },
        { usernameOrEmail: users.generic.username, password: 'abc' },
        { usernameOrEmail: users.generic.username, password: `${PASSWORD} ` },
      ];
      for (const attempt of attempts) {
        const res = await http().post('/api/auth/login').send(attempt);
        expect(res.status).toBe(401);
        expect(res.body).toEqual({
          message: GENERIC_ERROR,
          error: 'Unauthorized',
          statusCode: 401,
        });
      }
    });

    it('TC-API-012: a deactivated user cannot log in and gets the same generic 401', async () => {
      const res = await login(users.inactive.username);
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ message: GENERIC_ERROR, error: 'Unauthorized', statusCode: 401 });
    });

    it('TC-API-013: missing and empty fields return 400, not 500', async () => {
      const bodies = [
        {},
        { usernameOrEmail: '', password: '' },
        { usernameOrEmail: 'someone' },
        { usernameOrEmail: users.main.username, password: '' },
      ];
      for (const body of bodies) {
        const res = await http().post('/api/auth/login').send(body);
        expect(res.status).toBe(400);
      }

      const noUsername = await http().post('/api/auth/login').send({ password: PASSWORD });
      expect(noUsername.status).toBe(400);
      expect(noUsername.body.message).toBe('Username or email is required');
    });

    it('TC-API-014: wrong data types return 400', async () => {
      const bodies = [
        { usernameOrEmail: 12345, password: PASSWORD },
        { usernameOrEmail: true, password: PASSWORD },
        { usernameOrEmail: ['someone'], password: PASSWORD },
        { usernameOrEmail: { a: 1 }, password: PASSWORD },
        { usernameOrEmail: 'someone', password: 12345678 },
      ];
      for (const body of bodies) {
        const res = await http().post('/api/auth/login').send(body);
        expect(res.status).toBe(400);
      }
    });

    it('TC-API-017: other HTTP methods do not log in', async () => {
      for (const method of ['get', 'put', 'patch', 'delete'] as const) {
        const res = await http()[method]('/api/auth/login');
        expect([404, 405]).toContain(res.status);
        expect(res.body.accessToken).toBeUndefined();
      }
    });

    it('TC-API-032: passwords are stored as Argon2id hashes, never as plain text', async () => {
      const sadia = await prisma.user.findFirst({ where: { username: 'sadia' } });
      expect(sadia?.passwordHash.startsWith('$argon2id$')).toBe(true);
      expect(sadia?.passwordHash).not.toContain(PASSWORD);
      expect(await prisma.user.count({ where: { passwordHash: PASSWORD } })).toBe(0);
    });
  });

  describe('Logout (IMS-05.2 | FR-AUTH-02)', () => {
    it('TC-API-037, 038 and 039: logout succeeds, then the access token and the refresh token are rejected', async () => {
      const session = await loginAs('main');
      expect((await me(session.accessToken)).status).toBe(200);

      const out = await logoutWithCookie(session.refreshCookie);
      expect(out.status).toBe(200);
      expect(out.body).toEqual({ message: 'Logged out successfully' });
      expect(getRefreshCookie(out)).toMatch(/^refreshToken=;/);

      const reused = await me(session.accessToken);
      expect(reused.status).toBe(401);
      expect(reused.body.message).toBe('Token has been revoked');

      const renewed = await refresh(session.refreshToken);
      expect(renewed.status).toBe(401);
      expect(renewed.body.message).toBe('Refresh token has already been revoked');

      const row = await prisma.refreshToken.findUnique({
        where: { tokenHash: sha256(session.refreshToken) },
      });
      expect(row?.revokedAt).not.toBeNull();
    });

    it('TC-API-041: a second logout with the same token returns 401', async () => {
      const session = await loginAs('main');
      const logout = () =>
        http().post('/api/auth/logout').set('Authorization', `Bearer ${session.accessToken}`);

      expect((await logout()).status).toBe(200);
      expect((await logout()).status).toBe(401);
    });

    it('TC-API-042 and 043: logout with no token or a fake token returns 401', async () => {
      const none = await http().post('/api/auth/logout');
      expect(none.status).toBe(401);
      expect(none.body.message).toBe(
        'Authorization header, cookie, or refreshToken is required for logout',
      );

      const fake = await http().post('/api/auth/logout').set('Authorization', 'Bearer abc123');
      expect(fake.status).toBe(401);
    });

    it('TC-API-044: logging out one user does not affect another user', async () => {
      const first = await loginAs('main');
      const second = await loginAs('other');

      await logoutWithCookie(first.refreshCookie);

      expect((await me(second.accessToken)).status).toBe(200);
    });

    it('TC-API-045: logging in again after logout works', async () => {
      const first = await loginAs('main');
      await logoutWithCookie(first.refreshCookie);

      const second = await loginAs('main');
      expect((await me(second.accessToken)).status).toBe(200);
    });

    it('TC-API-040: logout ends only the current session (BAQ-S2-05, confirmed by the BA)', async () => {
      const sessionA = await loginAs('main');
      const sessionB = await loginAs('main');

      await logoutWithCookie(sessionA.refreshCookie);

      expect((await me(sessionA.accessToken)).status).toBe(401);
      expect((await refresh(sessionA.refreshToken)).status).toBe(401);
      expect((await me(sessionB.accessToken)).status).toBe(200);
      expect((await refresh(sessionB.refreshToken)).status).toBe(200);
    });

    it('TC-API-095: logout works with only the HttpOnly refresh cookie', async () => {
      const session = await loginAs('main');

      const out = await logoutWithCookie(session.refreshCookie);
      expect(out.status).toBe(200);
      expect((await refresh(session.refreshToken)).status).toBe(401);
    });
  });

  describe('Access and refresh tokens (IMS-05.3 | FR-AUTH-03, NFR-SEC-05)', () => {
    it('TC-API-048: the access token lives 15 minutes and carries the user claims', async () => {
      const session = await loginAs('main');
      const payload = decodePayload(session.accessToken);

      expect(payload.exp - payload.iat).toBe(900);
      expect(payload.sub).toBe(Number(users.main.id));
      expect(payload).toMatchObject({ username: users.main.username, role: 'Sales Staff' });
      expect(Object.keys(payload).join(' ').toLowerCase()).not.toMatch(/password|hash/);
    });

    it('TC-API-005: the refresh token is stored hashed and lasts 8 hours', async () => {
      const session = await loginAs('main');
      const row = await prisma.refreshToken.findUniqueOrThrow({
        where: { tokenHash: sha256(session.refreshToken) },
      });

      expect(row.tokenHash).toHaveLength(64);
      expect(row.tokenHash).not.toBe(session.refreshToken);
      expect(row.revokedAt).toBeNull();
      const hours = (row.expiresAt.getTime() - Date.now()) / 3_600_000;
      expect(hours).toBeGreaterThan(7.9);
      expect(hours).toBeLessThanOrEqual(8);
    });

    it('TC-API-049 and 050: an expired access token returns 401 "Token has expired" on every protected route', async () => {
      const session = await loginAs('main');
      const expired = authService.signAccessToken(session.user, -60);

      for (const route of PROTECTED_ROUTES) {
        const res = await http().get(route).set('Authorization', `Bearer ${expired}`);
        expect(res.status).toBe(401);
        expect(res.body.message).toBe('Token has expired');
      }
    });

    it('TC-API-054 and 055: a valid refresh token returns new tokens, and the old one cannot be used again', async () => {
      const session = await loginAs('main');

      const renewed = await refresh(session.refreshToken);
      expect(renewed.status).toBe(200);
      expect(renewed.body.accessToken).not.toBe(session.accessToken);
      expect(renewed.body).not.toHaveProperty('refreshToken');
      const rotatedRefreshCookie = getRefreshCookie(renewed);
      expect(getRefreshToken(rotatedRefreshCookie)).not.toBe(session.refreshToken);
      expect((await me(renewed.body.accessToken)).status).toBe(200);

      const replay = await refresh(session.refreshToken);
      expect(replay.status).toBe(401);
      expect(replay.body.message).toBe('Refresh token has already been revoked');
    });

    it('TC-API-056: the access token cannot be used as a refresh token', async () => {
      const session = await loginAs('main');
      const res = await refresh(session.accessToken);

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Invalid or expired refresh token');
    });

    it('TC-API-057: a refresh token cannot be used as an access token on protected routes', async () => {
      const session = await loginAs('main');

      for (const route of PROTECTED_ROUTES) {
        const res = await http().get(route).set('Authorization', `Bearer ${session.refreshToken}`);
        expect(res.status).toBe(401);
        expect(res.body.message).toBe('Invalid or expired token');
      }

      // The fix must not break the other uses: the access token, the refresh endpoint and logout
      expect((await me(session.accessToken)).status).toBe(200);
      const renewed = await refresh(session.refreshToken);
      expect(renewed.status).toBe(200);
      expect(renewed.body).not.toHaveProperty('refreshToken');
      const out = await logoutWithCookie(getRefreshCookie(renewed));
      expect(out.status).toBe(200);
    });

    it('TC-API-058: bad refresh input is rejected', async () => {
      const empty = await http().post('/api/auth/refresh').send({});
      expect(empty.status).toBe(401);
      expect(empty.body.message).toBe('Refresh token is required');

      const fake = await refresh('smartmart_refresh_nobody_not-a-real-token');
      expect(fake.status).toBe(401);

      const wrongType = await http().post('/api/auth/refresh').send({ refreshToken: 12345 });
      expect(wrongType.status).toBe(400);
    });

    it('TC-API-051: an expired refresh token is rejected', async () => {
      const session = await loginAs('main');
      await prisma.refreshToken.update({
        where: { tokenHash: sha256(session.refreshToken) },
        data: { expiresAt: new Date(Date.now() - 60_000) },
      });

      const res = await refresh(session.refreshToken);
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Refresh token has expired');
    });

    it('TC-API-059 and 071: a user deactivated after login can neither refresh nor call the API', async () => {
      const session = await loginAs('deact');
      await prisma.user.update({ where: { id: users.deact.id }, data: { isActive: false } });

      const renewed = await refresh(session.refreshToken);
      expect(renewed.status).toBe(401);
      expect(renewed.body.message).toBe('Invalid or expired refresh token');

      expect((await me(session.accessToken)).status).toBe(401);
    });
  });

  describe('Auth guard on every route (IMS-05.5 | NFR-SEC-01)', () => {
    it('TC-API-068: protected routes return 401 with no token, a Basic header or a fake Bearer token', async () => {
      for (const route of PROTECTED_ROUTES) {
        const none = await http().get(route);
        expect(none.status).toBe(401);
        expect(none.body.message).toBe('Authorization header is missing');

        const basic = await http().get(route).set('Authorization', 'Basic abc');
        expect(basic.status).toBe(401);
        expect(basic.body.message).toBe('Invalid authorization scheme, Bearer token required');

        const fake = await http().get(route).set('Authorization', 'Bearer fake');
        expect(fake.status).toBe(401);
      }
    });

    it('the public routes work without a token, and refresh and logout still need their own token', async () => {
      expect((await http().get('/api/health')).status).toBe(200);
      expect((await login(users.main.username)).status).toBe(200);

      const noRefresh = await http().post('/api/auth/refresh');
      expect(noRefresh.status).toBe(401);
      expect(noRefresh.body.message).toBe('Refresh token is required');
    });

    it('TC-API-069: every protected route accepts a valid access token', async () => {
      const session = await loginAs('main');

      for (const route of PROTECTED_ROUTES) {
        const res = await http().get(route).set('Authorization', `Bearer ${session.accessToken}`);
        expect(res.status).toBe(200);
      }
    });

    it('TC-API-062: a token with an edited payload is rejected', async () => {
      const session = await loginAs('main');
      const [header, payload, signature] = session.accessToken.split('.');
      const edited = base64url({ ...decodePayload(session.accessToken), role: 'Administrator' });
      expect(edited).not.toBe(payload);

      const res = await me(`${header}.${edited}.${signature}`);
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Invalid token signature');
    });

    it('TC-API-063: a token with an edited signature or a wrong secret is rejected', async () => {
      const session = await loginAs('main');
      const [header, payload, signature] = session.accessToken.split('.');

      const badSignature = `${signature[0] === 'A' ? 'B' : 'A'}${signature.slice(1)}`;
      const edited = await me(`${header}.${payload}.${badSignature}`);
      expect(edited.status).toBe(401);
      expect(edited.body.message).toBe('Invalid token signature');

      const wrongSecret = createHmac('sha256', 'secret')
        .update(`${header}.${payload}`)
        .digest('base64url');
      const forged = await me(`${header}.${payload}.${wrongSecret}`);
      expect(forged.status).toBe(401);
      expect(forged.body.message).toBe('Invalid token signature');
    });

    it('TC-API-064: an unsigned token with alg none is rejected', async () => {
      const session = await loginAs('main');
      const payload = session.accessToken.split('.')[1];
      const unsigned = `${base64url({ alg: 'none', typ: 'JWT' })}.${payload}.`;

      expect((await me(unsigned)).status).toBe(401);
    });

    it('TC-API-072: an unknown route without a token returns 404 and no data', async () => {
      const res = await http().get('/api/this-route-does-not-exist');
      expect(res.status).toBe(404);
      expect(res.body.message).toContain('Cannot GET');
    });
  });

  describe('Failed-login throttling (IMS-05.4 | FR-AUTH-05)', () => {
    it('TC-API-076, 077, 081: five wrong passwords lock the account; the sixth try is blocked even with the right password', async () => {
      for (let attempt = 1; attempt <= 5; attempt++) {
        const res = await login(users.lock1.username, 'WrongPass#1');
        expect(res.status).toBe(401);
        expect(res.body.message).toBe(GENERIC_ERROR);
        expect((await throttleState('lock1')).failedLogins).toBe(attempt);
      }
      const locked = await throttleState('lock1');
      expect(locked.lockedUntil).not.toBeNull();
      expect(locked.lockedUntil!.getTime()).toBeGreaterThan(Date.now());

      const right = await login(users.lock1.username);
      expect(right.status).toBe(429);
      expect(right.body).toMatchObject({ status: 429, code: 'TEMPORARILY_LOCKED' });
      const retryAfter = Number(right.headers['retry-after']);
      expect(retryAfter).toBeGreaterThanOrEqual(1);
      expect(retryAfter).toBeLessThanOrEqual(900);
      expect(right.body.retryAfter).toBeLessThanOrEqual(900);

      // A wrong password gets the same answer, so the response does not reveal if the password was right
      const wrong = await login(users.lock1.username, 'WrongPass#1');
      expect(wrong.status).toBe(429);
      expect(wrong.body.code).toBe(right.body.code);

      // The lock follows the account, not the spelling of the name or the IP address
      const upper = await login(users.lock1.email.toUpperCase());
      expect(upper.status).toBe(429);
      for (const ip of ['10.0.0.1', '10.0.0.2']) {
        const res = await login(users.lock1.username).set('X-Forwarded-For', ip);
        expect(res.status).toBe(429);
      }

      // Other accounts are not affected
      expect((await login(users.other.username)).status).toBe(200);
    });

    it('TC-API-078: four wrong passwords do not lock, and a successful login resets the counters', async () => {
      for (let attempt = 1; attempt <= 4; attempt++) {
        expect((await login(users.lock2.username, 'WrongPass#1')).status).toBe(401);
      }
      const before = await throttleState('lock2');
      expect(before.failedLogins).toBe(4);
      expect(before.lockedUntil).toBeNull();

      expect((await login(users.lock2.username)).status).toBe(200);

      const after = await throttleState('lock2');
      expect(after).toEqual({ failedLogins: 0, firstFailedAt: null, lockedUntil: null });
    });

    it('TC-API-079 and 080: the lock ends when locked_until passes, and Retry-After counts down', async () => {
      await prisma.user.update({
        where: { id: users.lock3.id },
        data: {
          failedLogins: 5,
          firstFailedAt: new Date(),
          lockedUntil: new Date(Date.now() + 120_000),
        },
      });

      const first = await login(users.lock3.username);
      expect(first.status).toBe(429);
      await sleep(1_100);
      const second = await login(users.lock3.username);
      expect(second.status).toBe(429);
      expect(Number(second.headers['retry-after'])).toBeLessThan(
        Number(first.headers['retry-after']),
      );

      await prisma.user.update({
        where: { id: users.lock3.id },
        data: { lockedUntil: new Date(Date.now() - 1_000) },
      });
      expect((await login(users.lock3.username)).status).toBe(200);
      expect(await throttleState('lock3')).toEqual({
        failedLogins: 0,
        firstFailedAt: null,
        lockedUntil: null,
      });
    });
  });
});
