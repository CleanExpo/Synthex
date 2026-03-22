'use client';

import { useTheme } from 'next-themes';
import { Toaster as Sonner } from 'sonner';

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
            'group toast group-[.toaster]:bg-[#050505] group-[.toaster]:text-white group-[.toaster]:border-[0.5px] group-[.toaster]:border-white/[0.08] group-[.toaster]:shadow-lg group-[.toaster]:shadow-black/40',
          description: 'group-[.toast]:text-white/60',
          actionButton:
            'group-[.toast]:bg-orange-500 group-[.toast]:text-[#050505]',
          cancelButton:
            'group-[.toast]:bg-white/[0.06] group-[.toast]:text-white/60',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
