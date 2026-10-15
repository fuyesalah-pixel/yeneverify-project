import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { AppConfigService } from '../config/config.service';
import pkg from '../../package.json';

@ApiTags('Health')
@Controller('version')
export class VersionController {
  constructor(private readonly config: AppConfigService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'App version info' })
  version() {
    return {
      name: pkg.name,
      version: pkg.version,
      commit: this.config.gitSha ?? 'dev',
      env: this.config.runtime.nodeEnv,
    };
  }
}
