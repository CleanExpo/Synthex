'use client';

import Image from 'next/image';

type IconCategory =
  | 'navigation'
  | 'features'
  | 'platforms'
  | 'actions'
  | 'status'
  | 'utility'
  | 'showcase';

interface Icon3DProps {
  name: string;
  category: IconCategory;
  size?: 24 | 32 | 48;
  className?: string;
  alt?: string;
}

export function Icon3D({
  name,
  category,
  size = 24,
  className,
  alt,
}: Icon3DProps) {
  return (
    <Image
      src={`/icons/3d/${category}/${name}.svg`}
      alt={alt ?? name}
      width={size}
      height={size}
      className={className}
    />
  );
}
