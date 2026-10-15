export const QUEUE_NAMES = {
  VERIFICATION: 'verification',
  NOTIFICATION: 'notification',
  EXPORT: 'export',
  ANALYTICS: 'analytics',
  MAINTENANCE: 'maintenance',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
