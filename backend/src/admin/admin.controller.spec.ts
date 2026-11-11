// ============================================================
// Yene Verify — Admin Controller Unit Tests
// ============================================================

import { AdminController } from './admin.controller';

const adminServiceMock: any = {
  googleLogin: jest.fn().mockResolvedValue({ accessToken: 'a', refreshToken: 'r', expiresIn: 900 }),
  getHealth: jest.fn().mockResolvedValue({ status: 'ok' }),
  getUsers: jest.fn().mockResolvedValue({ users: [], total: 0 }),
};

function buildController(): AdminController {
  return new AdminController(adminServiceMock);
}

describe('AdminController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates Google sign-in with ip and user agent', async () => {
    const controller = buildController();

    const result = await controller.adminGoogleLogin(
      { idToken: 'id-token' },
      '1.2.3.4',
      { headers: { 'user-agent': 'jest' } } as any,
    );

    expect(adminServiceMock.googleLogin).toHaveBeenCalledWith({
      idToken: 'id-token',
      ip: '1.2.3.4',
      userAgent: 'jest',
    });
    expect(result).toEqual({ accessToken: 'a', refreshToken: 'r', expiresIn: 900 });
  });

  it('returns the health payload', async () => {
    const controller = buildController();

    await expect(controller.getHealth()).resolves.toEqual({ status: 'ok' });
  });

  it('passes list filters through to the service', async () => {
    const controller = buildController();
    const query = { page: 2, pageSize: 10, role: 'MERCHANT' as const };

    await controller.getUsers(query);

    expect(adminServiceMock.getUsers).toHaveBeenCalledWith(query);
  });
});
