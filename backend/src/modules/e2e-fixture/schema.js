import { z } from 'zod';

export const createE2eFixtureSchema = z.object({
  // TODO: add fields
});

export const updateE2eFixtureSchema = createE2eFixtureSchema.partial();
