import { v7 as uuidv7 } from 'uuid';

/**
 * Generates a UUID v7 string.
 * Time-sortable — use for ALL entity primary keys.
 * Never call prisma.X.create() without passing id: newId().
 */
export const newId = (): string => uuidv7();

export { uuidv7 };
