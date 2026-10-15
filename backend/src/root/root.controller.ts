import { Controller, Get, Redirect } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';

/** GET / → 302 redirect to /docs */
@Controller()
@ApiExcludeController()
export class RootController {
  @Get()
  @Public()
  @Redirect('/docs', 302)
  root() {
    return;
  }
}
