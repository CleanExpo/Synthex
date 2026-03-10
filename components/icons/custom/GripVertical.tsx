/**
 * GripVertical Icon - Custom SVG implementation
 * Used for drag handles in drag-and-drop interfaces
 */

import React from 'react';

interface GripVerticalProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const GripVertical = React.forwardRef<SVGSVGElement, GripVerticalProps>(
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
      <circle cx="9" cy="12" r="1" fill="currentColor" />
      <circle cx="9" cy="5" r="1" fill="currentColor" />
      <circle cx="9" cy="19" r="1" fill="currentColor" />
      <circle cx="15" cy="12" r="1" fill="currentColor" />
      <circle cx="15" cy="5" r="1" fill="currentColor" />
      <circle cx="15" cy="19" r="1" fill="currentColor" />
    </svg>
  )
);

GripVertical.displayName = 'GripVertical';

export default GripVertical;
