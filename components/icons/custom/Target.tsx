/**
 * Target Icon - Custom SVG implementation
 * Used for goal/targeting features
 */

import React from 'react';

interface TargetProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const Target = React.forwardRef<SVGSVGElement, TargetProps>(
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
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  )
);

Target.displayName = 'Target';

export default Target;
