'use client';

interface NotificationBadgeProps {
  count: number;
}

export default function NotificationBadge({ count }: NotificationBadgeProps) {
  if (count <= 0) return null;

  return (
    <span
      aria-label={`${count} unread notification${count === 1 ? '' : 's'}`}
      className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white ring-2 ring-slate-900"
    >
      {count > 9 ? '9+' : count}
    </span>
  );
}
