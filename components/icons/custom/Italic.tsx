/**
 * Italic Icon - Custom SVG implementation
 * Used for rich text editor
 */

import React from 'react';

interface ItalicProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const Italic = React.forwardRef<SVGSVGElement, ItalicProps>(
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
      <line x1="19" x2="10" y1="4" y2="4" />
      <line x1="14" x2="5" y1="20" y2="20" />
      <line x1="15" x2="9" y1="4" y2="20" />
    </svg>
  )
);

Italic.displayName = 'Italic';

export default Italic;
