import React from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  description?: string;
}

export function MetricCard({ title, value, description }: MetricCardProps) {
  return (
    <div className="border rounded-md p-4 bg-sx-bg-secondary">
      <div className="text-sm font-medium text-sx-text-secondary">{title}</div>
      <div className="mt-2 text-2xl font-bold text-sx-text-primary">
        {value}
      </div>
      {description && (
        <div className="mt-2 text-xs text-sx-text-muted">{description}</div>
      )}
    </div>
  );
}

export function MetricCardTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-sm font-medium text-sx-text-secondary">{children}</div>
  );
}

export function MetricCardValue({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`mt-2 text-2xl font-bold text-sx-text-primary ${className}`}
    >
      {children}
    </div>
  );
}
