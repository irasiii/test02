import PageHeader from '@/components/PageHeader';

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" subtitle="App configuration (placeholder)" />
      <div className="card">
        <p className="text-muted text-sm">
          Settings would live here: branding, surge defaults, payment gateway, FCM topics,
          region toggles, I18N, role permissions.
        </p>
      </div>
    </>
  );
}
