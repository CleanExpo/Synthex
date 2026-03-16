/**
 * Remotion Entry Point
 *
 * Registers the RemotionRoot with the Remotion runtime.
 * This is the entry file used by the Remotion CLI and renderer.
 */

import { registerRoot } from 'remotion';
import { RemotionRoot } from './Root';

registerRoot(RemotionRoot);
