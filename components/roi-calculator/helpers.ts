/**
 * ROI Calculator Helpers
 */

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function getROIColor(roi: number) {
  if (roi > 100) return 'text-green-400';
  if (roi > 0) return 'text-yellow-400';
  return 'text-red-400';
}

export function getStatusColor(status: string) {
  switch (status) {
    case 'active': return 'bg-green-500';
    case 'completed': return 'bg-blue-500';
    case 'planned': return 'bg-gray-500';
    default: return 'bg-gray-500';
  }
}
