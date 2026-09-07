import { redirect } from 'next/navigation';

/** Calendar owns when. Old Schedule URL stays as a door into Calendar. */
export default function ScheduleRedirectPage() {
  redirect('/dashboard/calendar');
}
