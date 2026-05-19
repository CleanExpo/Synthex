import { META_CREATIVE_SPECS, type MetaCreativeFormat } from './specs';

export function isSupportedMetaCreativeFormat(format: string): format is MetaCreativeFormat {
  return Object.hasOwn(META_CREATIVE_SPECS, format);
}

export function getUnsupportedMetaFormats(formats: string[]) {
  return formats.filter((format) => !isSupportedMetaCreativeFormat(format));
}
