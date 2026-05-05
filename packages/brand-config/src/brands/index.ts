import type { BrandConfig, BrandSlug } from '../types';
import { ra } from './ra';
import { dr } from './dr';
import { nrpg } from './nrpg';
import { carsi } from './carsi';
import { ccw } from './ccw';
import { synthex } from './synthex';
import { unite } from './unite';

export const brands: Record<BrandSlug, BrandConfig> = {
  ra,
  dr,
  nrpg,
  carsi,
  ccw,
  synthex,
  unite,
};

export { ra, dr, nrpg, carsi, ccw, synthex, unite };
