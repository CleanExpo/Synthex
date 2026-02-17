'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ComponentType, SVGProps } from 'react';

type IconComponent = ComponentType<SVGProps<SVGSVGElement> & { className?: string }>;

interface DashboardEmptyStateProps {
  icon: IconComponent;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: IconComponent;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function DashboardEmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}: DashboardEmptyStateProps) {
  return (
    <Card className={cn('bg-white/[0.02] backdrop-blur-xl border-white/[0.06]', className)}>
      <CardContent className="py-16 text-center">
        <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-cyan-500/10 flex items-center justify-center">
          <Icon className="h-8 w-8 text-cyan-400" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
        <p className="text-slate-400 mb-6 max-w-md mx-auto">{description}</p>
        <div className="flex items-center justify-center gap-3">
          {action && (
            <Button onClick={action.onClick} className="gradient-primary text-white">
              {action.icon && <action.icon className="mr-2 h-4 w-4" />}
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button variant="outline" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
