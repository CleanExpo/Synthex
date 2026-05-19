import { getUnsupportedMetaFormats, isSupportedMetaCreativeFormat } from './creative-checks';
import { META_CREATIVE_SPECS } from './specs';

export function buildMetaCreativeExport({
  campaignId,
  creativeId,
  formats,
}: {
  campaignId: string;
  creativeId: string;
  formats: string[];
}) {
  const unsupportedFormats = getUnsupportedMetaFormats(formats);

  return {
    campaignId,
    creativeId,
    publishAllowed: false,
    unsupportedFormats,
    creatives: formats.filter(isSupportedMetaCreativeFormat).map((format) => ({
      creativeId: `${creativeId}-${format}`,
      spec: META_CREATIVE_SPECS[format],
    })),
  };
}
