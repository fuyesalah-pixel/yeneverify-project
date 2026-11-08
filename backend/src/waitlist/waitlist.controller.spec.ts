// ============================================================
// Yene Verify â€” Waitlist Controller Unit Tests
// ============================================================

import { HttpStatus } from '@nestjs/common';
import { WaitlistController } from './waitlist.controller';

const serviceMock: any = {
  subscribe: jest.fn().mockResolvedValue({ ok: true, created: true }),
};

const res: any = {
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
};

describe('WaitlistController', () => {
  let controller: WaitlistController;

  beforeEach(() => {
    jest.clearAllMocks();
    serviceMock.subscribe.mockResolvedValue({ ok: true, created: true });
    res.status.mockReturnThis();
    res.json.mockReturnThis();
    controller = new WaitlistController(serviceMock);
  });

  it('returns 201 { ok: true } when created', async () => {
    serviceMock.subscribe.mockResolvedValue({ ok: true, created: true });

    await controller.subscribe(
      { email: 'a@example.com', source: 'landing' },
      '191.215.39.105',
      res,
    );

    expect(serviceMock.subscribe).toHaveBeenCalledWith(
      { email: 'a@example.com', source: 'landing', ip: '191.215.39.105' },
    );
    expect(res.status).toHaveBeenCalledWith(HttpStatus.CREATED);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it('returns 200 { ok: true } when already subscribed (idempotent)', async () => {
    serviceMock.subscribe.mockResolvedValue({ ok: true, created: false });

    await controller.subscribe({ email: 'a@example.com' }, '191.215.39.105', res);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });
});
