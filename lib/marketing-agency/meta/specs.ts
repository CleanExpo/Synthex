export type MetaCreativeFormat = '9:16' | '1:1' | '4:5' | '16:9';

export interface MetaCreativeSpec {
  format: MetaCreativeFormat;
  placement: string;
  width: number;
  height: number;
}

export const META_CREATIVE_SPECS: Record<MetaCreativeFormat, MetaCreativeSpec> = {
  '9:16': {
    format: '9:16',
    placement: 'reels-stories',
    width: 1080,
    height: 1920,
  },
  '1:1': {
    format: '1:1',
    placement: 'feed-square',
    width: 1080,
    height: 1080,
  },
  '4:5': {
    format: '4:5',
    placement: 'feed-portrait',
    width: 1080,
    height: 1350,
  },
  '16:9': {
    format: '16:9',
    placement: 'feed-landscape',
    width: 1920,
    height: 1080,
  },
};
