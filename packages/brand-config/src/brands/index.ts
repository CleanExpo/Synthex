import type { BrandConfig, BrandSlug } from '../types';
import { ra } from './ra';
import { dr } from './dr';
import { nrpg } from './nrpg';
import { carsi } from './carsi';
import { synthex } from './synthex';
import { unite } from './unite';
import { johnCoutis } from './john-coutis';

export const brands: Record<BrandSlug, BrandConfig> = {
  ra,
  dr,
  nrpg,
  carsi,
  synthex,
  unite,
  'john-coutis': johnCoutis,
};

export { ra, dr, nrpg, carsi, synthex, unite, johnCoutis };
