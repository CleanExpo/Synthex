import { createClient } from '@/lib/platform/noop-client';

export function createBrowserClient() {
  return createClient();
}
