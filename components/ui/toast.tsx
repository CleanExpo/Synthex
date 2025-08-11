'use client';

import * as React from 'react';
import { Toaster as Sonner } from 'sonner';
import { useTheme } from 'next-themes';

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast glass-card group-[.toaster]:text-white group-[.toaster]:border-white/10 group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-gray-400',
          actionButton:
            'group-[.toast]:bg-purple-500 group-[.toast]:text-white',
          cancelButton:
            'group-[.toast]:bg-white/10 group-[.toast]:text-gray-400',
          error: 'group-[.toaster]:bg-red-500/10 group-[.toaster]:border-red-500/20',
          success: 'group-[.toaster]:bg-green-500/10 group-[.toaster]:border-green-500/20',
          warning: 'group-[.toaster]:bg-yellow-500/10 group-[.toaster]:border-yellow-500/20',
          info: 'group-[.toaster]:bg-blue-500/10 group-[.toaster]:border-blue-500/20',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };