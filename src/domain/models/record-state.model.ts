export const RECORD_STATES = ['ACTIVE', 'REMOVED'] as const;

export type RecordState = (typeof RECORD_STATES)[number];
