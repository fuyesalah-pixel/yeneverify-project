import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

/**
 * PLACEHOLDER — real implementation in Step 9.
 *
 * Will validate that:
 *  - The device_id claim in the JWT matches a bound, non-revoked device.
 *  - The session has not been revoked.
 */
@Injectable()
export class DeviceGuard implements CanActivate {
  canActivate(_ctx: ExecutionContext): boolean {
    // Placeholder: always passes until Step 9 wires the real check.
    return true;
  }
}
