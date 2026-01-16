/**
 * Heading2 Icon - Custom SVG implementation
 * Used for rich text editor
 */

import React from 'react';

interface Heading2Props extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const Heading2 = React.forwardRef<SVGSVGElement, Heading2Props>(
  ({ size = 24, className, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M4 12h8" />
      <path d="M4 18V6" />
      <path d="M12 18V6" />
      <path d="M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1" />
    </svg>
  )
);

Heading2.displayName = 'Heading2';

export default Heading2;
