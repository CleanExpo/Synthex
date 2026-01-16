/**
 * Bold Icon - Custom SVG implementation
 * Used for rich text editor
 */

import React from 'react';

interface BoldProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const Bold = React.forwardRef<SVGSVGElement, BoldProps>(
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
      <path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8" />
    </svg>
  )
);

Bold.displayName = 'Bold';

export default Bold;
