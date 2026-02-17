/**
 * Pre-configured rate limit wrappers by route sensitivity category.
 *
 * @deprecated Import from '@/lib/rate-limit' instead.
 * This file re-exports from the consolidated rate-limit module for backward compatibility.
 *
 * Usage:
 *   import { authStrict } from '@/lib/rate-limit';
 *   export async function POST(req: NextRequest) {
 *     return authStrict(req, async () => { ... });
 *   }
 */

export {
  authStrict,
  authGeneral,
  admin,
  billing,
  aiGeneration,
  mutation,
  readDefault,
} from '@/lib/rate-limit';
