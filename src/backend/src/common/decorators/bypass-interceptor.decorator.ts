import { SetMetadata } from '@nestjs/common';

export const BYPASS_INTERCEPTOR_KEY = 'bypassInterceptor';
export const BypassInterceptor = () =>
  SetMetadata(BYPASS_INTERCEPTOR_KEY, true);
