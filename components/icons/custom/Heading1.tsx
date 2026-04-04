/**
 * Heading1 Icon - Custom SVG implementation
 * Used for rich text editor
 */

import React from 'react';

interface Heading1Props extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const Heading1 = React.forwardRef<SVGSVGElement, Heading1Props>(
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
      <path d="m17 12 3-2v8" />
    </svg>
  )
);

Heading1.displayName = 'Heading1';

export default Heading1;
