'use client';
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import React from 'react';

type PresetType =
  | 'fade'
  | 'slide'
  | 'scale'
  | 'blur'
  | 'blur-slide'
  | 'zoom'
  | 'flip'
  | 'bounce'
  | 'rotate'
  | 'swing';

type AnimatedGroupProps = {
  children: ReactNode;
  className?: string;
  variants?: {
    container?: Record<string, unknown>;
    item?: Record<string, unknown>;
  };
  preset?: PresetType;
};

function AnimatedGroup({
  children,
  className,
  variants,
  preset,
}: AnimatedGroupProps) {
  return (
    <div className={cn(className)}>
      {React.Children.map(children, (child, index) => (
        <div key={index}>{child}</div>
      ))}
    </div>
  );
}

export { AnimatedGroup };
