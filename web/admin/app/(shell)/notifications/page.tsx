import { SectionPlaceholder } from '@/components/section-placeholder';

export default function Page() {
  return (
    <SectionPlaceholder
      phase="Phase C"
      title="Notifications"
      description="Admin-sent announcements with delivery tracking. Auto-generated notifications are excluded."
      planned={[
        'Compose: target (user / role / all), title, body, type (info / warning / system), optional deep link',
        'Preview before sending, then confirm the projected recipient count',
        'Delivery via FCM plus in-app notification rows',
        'History: title, target, recipients, sent at, delivered and failed counts',
        'Per-notification delivery breakdown and reusable templates',
      ]}
    />
  );
}
