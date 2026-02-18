import React from 'react';

interface ToggleRightProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const ToggleRight = React.forwardRef<SVGSVGElement, ToggleRightProps>(
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
      <rect width="20" height="12" x="2" y="6" rx="6" />
      <circle cx="16" cy="12" r="2" />
    </svg>
  )
);

ToggleRight.displayName = 'ToggleRight';

export default ToggleRight;
