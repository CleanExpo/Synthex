import { redirect } from 'next/navigation';

/** Queue is a Calendar tab, not a separate first-week product. */
export default function PublishingQueueRedirectPage() {
  redirect('/dashboard/calendar?view=queue');
}
