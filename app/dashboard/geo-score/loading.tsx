import { GeoScoreSkeleton } from '@/components/geo/GeoScoreSkeleton';

export default function GeoScoreLoading() {
  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <GeoScoreSkeleton coldStart={false} />
    </div>
  );
}
