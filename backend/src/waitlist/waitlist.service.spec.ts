// ============================================================
// Yene Verify â€” Waitlist Service Unit Tests
// Isolated service logic: rate limiting, idempotency, creation.
// ============================================================

import { ERROR_CODES } from '../common/constants/error-codes';
import { WaitlistService } from './waitlist.service';

const repoMock: any = {
  findByEmail: jest.fn(),
  create: jest.fn(),
};
const redisMock: any = {
  incr: jest.fn(),
};

function buildService() {
  return new WaitlistService(repoMock, redisMock);
}

describe('WaitlistService', () => {
  let service: WaitlistService;

  const baseDto = { email: 'merchant@example.com', source: 'landing', ip: '191.215.39.105' };

  beforeEach(() => {
    jest.clearAllMocks();
    repoMock.findByEmail.mockResolvedValue(null);
    repoMock.create.mockResolvedValue({ id: 'wl-1', email: baseDto.email });
    redisMock.incr.mockResolvedValue(1);
    service = buildService();
  });

  it('creates a new waitlist entry and returns created=true (201)', async () => {
    const out = await service.subscribe(baseDto);

    expect(out).toEqual({ ok: true, created: true });
    expect(redisMock.incr).toHaveBeenCalledWith(`waitlist:ip:${baseDto.ip}`, 3600);
    expect(repoMock.findByEmail).toHaveBeenCalledWith(baseDto.email);
    expect(repoMock.create).toHaveBeenCalledWith({
      email: baseDto.email,
      source: baseDto.source,
      ip: baseDto.ip,
    });
  });

  it('returns created=false (200) for a duplicate email without creating again', async () => {
    repoMock.findByEmail.mockResolvedValue({ id: 'wl-1', email: baseDto.email });

    const out = await service.subscribe(baseDto);

    expect(out).toEqual({ ok: true, created: false });
    expect(repoMock.create).not.toHaveBeenCalled();
  });

  it('rate limits at 5 submissions per IP per hour (429)', async () => {
    redisMock.incr.mockResolvedValue(6);

    await expect(service.subscribe(baseDto)).rejects.toMatchObject({
      code: ERROR_CODES.RATE_LIMITED,
      httpStatus: 429,
    });
    expect(repoMock.create).not.toHaveBeenCalled();
  });

  it('allows submissions 1 through 5, rejects the 6th', async () => {
    redisMock.incr.mockResolvedValueOnce(1).mockResolvedValueOnce(5);

    await expect(service.subscribe(baseDto)).resolves.toMatchObject({ created: true });
    await expect(service.subscribe(baseDto)).resolves.toMatchObject({ created: true });

    redisMock.incr.mockResolvedValueOnce(6);
    await expect(service.subscribe(baseDto)).rejects.toMatchObject({ httpStatus: 429 });
  });

  it('does not rate limit when no IP is provided', async () => {
    await service.subscribe({ email: baseDto.email, source: baseDto.source });
    expect(redisMock.incr).not.toHaveBeenCalled();
    expect(repoMock.create).toHaveBeenCalled();
  });
});
