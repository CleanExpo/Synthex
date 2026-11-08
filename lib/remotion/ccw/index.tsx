/**
 * SYN-1404: separate Remotion entry for CCW short-form renders, so the shared
 * composition registry (lib/remotion/Root.tsx) is untouched.
 *
 * Render with scripts/render-ccw-shortform.ts.
 */

import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { CcwShortform, type CcwShortformProps } from './CcwShortform';

const defaults: CcwShortformProps = {
  voice: 'voice.mp3',
  cta: 'See the drying range',
  url: 'ccwonline.com.au',
  logo: 'logos/ccw/primary.svg',
  shots: [],
  words: [],
};

const CcwRoot: React.FC = () => (
  <Composition
    id="CcwShortform"
    component={CcwShortform}
    durationInFrames={900}
    fps={30}
    width={1080}
    height={1920}
    defaultProps={defaults}
    calculateMetadata={({ props }) => ({
      // The video ends where the last shot (the end card) ends.
      durationInFrames: props.shots.length
        ? Math.round(props.shots[props.shots.length - 1].to * 30)
        : 900,
    })}
  />
);

registerRoot(CcwRoot);
