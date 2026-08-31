import React from 'react';

export interface TableProps {
  children: React.ReactNode;
  className?: string;
}

export function Table({ children, className = '' }: TableProps) {
  return (
    <div className="overflow-x-auto border rounded-md">
      <table className={`w-full text-sm text-left ${className}`}>
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ children }: { children: React.ReactNode }) {
  return (
    <thead className="bg-sx-bg-tertiary text-sx-text-primary font-medium">
      {children}
    </thead>
  );
}

export function TableBody({ children }: { children: React.ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function TableHead({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 border-b">{children}</th>;
}

export function TableRow({ children }: { children: React.ReactNode }) {
  return <tr className="border-b border-sx-border">{children}</tr>;
}

export function TableCell({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}
