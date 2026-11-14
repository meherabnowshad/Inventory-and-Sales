import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a controller or route handler as publicly accessible without a Bearer token.
 * All other routes are protected by the global AuthGuard (NFR-SEC-01).
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
