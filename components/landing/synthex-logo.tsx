'use client';

import Image from 'next/image';

/** Current official Synthex mark, shared with the favicon and offline logo pack. */
export function SynthexLogo({
  className = 'w-10 h-10',
}: {
  className?: string;
}) {
  return (
    <Image
      src="/logos/synthex/primary.svg"
      alt="Synthex"
      width={40}
      height={40}
      className={className}
      unoptimized
    />
  );
}
