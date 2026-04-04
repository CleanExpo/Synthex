/**
 * Columns Icon - Custom SVG implementation
 * Used for layout/grid features
 */

import React from 'react';

interface ColumnsProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const Columns = React.forwardRef<SVGSVGElement, ColumnsProps>(
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
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <line x1="12" x2="12" y1="3" y2="21" />
    </svg>
  )
);

Columns.displayName = 'Columns';

export default Columns;
