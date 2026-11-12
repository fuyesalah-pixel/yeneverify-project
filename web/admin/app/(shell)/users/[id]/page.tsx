import Link from 'next/link';
import { loadPageData } from '@/lib/backend';
import { revokeUserDevice } from '@/lib/actions';
import type { UserDetail } from '@/lib/types';
import {
  formatDateTime,
  formatDate,
  formatRelative,
  formatMoneyMinor,
  formatSigned,
  formatNumber,
  truncate,
} from '@/lib/format';
import {
  Badge,
  statusTone,
  Card,
  Stat,
  Field,
  DataError,
  EmptyRow,
  TABLE_HEAD,
  TABLE_CELL,
} from '@/components/ui';
import { FlashToast } from '@/components/flash-toast';
import {
  AdjustCreditsButton,
  ChangeRoleButton,
  ResetPinButton,
  StatusActionButton,
} from '@/components/user-actions';

export async function generateMetadata({ params }: { params: { id: string } }) {
  return { title: `User ${params.id.slice(0, 8)}…` };
}

// ── tiny server-action wrappers baked into this page ─────────────────────────

function RevokeDeviceButton({
  userId,
  deviceId,
  returnTo,
}: {
  userId: string;
  deviceId: string;
  returnTo: string;
}) {
  return (
    <form action={revokeUserDevice}>
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="deviceId" value={deviceId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <button
        type="submit"
        className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-100 transition"
      >
        Revoke
      </button>
    </form>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

export default async function UserDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: Record<string, string | undefined>;
}) {
  const returnTo = `/users/${params.id}`;
  const result = await loadPageData<UserDetail>(`/admin/users/${params.id}`, returnTo);

  if (!result.ok) {
    return (
      <main className="p-6 md:p-8">
        <Link href="/users" className="mb-4 inline-block text-xs font-medium text-brand-dark hover:underline">
          ← Back to users
        </Link>
        <DataError message={result.message} />
      </main>
    );
  }

  const { profile, merchant, subscription, credits, activity, recentTransactions, recentCredits, recentVerifications, auditTrail, devices } = result.data;

  const notice = searchParams.notice;
  const error = searchParams.error;

  const isActive = profile.status === 'ACTIVE';
  const isSuspended = profile.status === 'SUSPENDED';
  const isBanned = profile.status === 'BANNED';
  const isAdmin = profile.role === 'ADMIN';

  return (
    <main className="p-6 md:p-8">
      {/* breadcrumb */}
      <Link href="/users" className="mb-4 inline-block text-xs font-medium text-brand-dark hover:underline">
        ← Back to users
      </Link>

      <FlashToast notice={notice} error={error} />

      {/* header row */}
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{profile.fullName || '—'}</h1>
          <p className="mt-1 text-sm text-slate-500">{profile.phone}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={statusTone(profile.status)}>{profile.status}</Badge>
          <Badge
            tone={profile.role === 'MERCHANT' ? 'green' : profile.role === 'ADMIN' ? 'blue' : 'slate'}
          >
            {profile.role.replace('_', ' ')}
          </Badge>
        </div>
      </div>

      {/* action strip */}
      {!isAdmin && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3">
          <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Actions</span>
          {isActive && (
            <>
              <StatusActionButton userId={profile.id} action="SUSPEND" returnTo={returnTo} />
              <StatusActionButton userId={profile.id} action="BAN" returnTo={returnTo} />
            </>
          )}
          {isSuspended && (
            <>
              <StatusActionButton userId={profile.id} action="REACTIVATE" returnTo={returnTo} />
              <StatusActionButton userId={profile.id} action="BAN" returnTo={returnTo} />
            </>
          )}
          {isBanned && (
            <StatusActionButton userId={profile.id} action="REACTIVATE" returnTo={returnTo} />
          )}
          <ResetPinButton userId={profile.id} returnTo={returnTo} />
          {credits.merchantId && (
            <AdjustCreditsButton
              userId={profile.id}
              returnTo={returnTo}
              balance={credits.ledgerBalance}
            />
          )}
          {(profile.role === 'MERCHANT' || profile.role === 'SUB_MERCHANT') && (
            <ChangeRoleButton
              userId={profile.id}
              returnTo={returnTo}
              currentRole={profile.role}
            />
          )}
        </div>
      )}

      {/* stat row */}
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Credits balance"
          value={credits.merchantId ? Number(credits.ledgerBalance).toLocaleString('en-GB') : '—'}
          note="Ledger-derived balance"
        />
        <Stat
          label="Total verifications"
          value={formatNumber(activity.totalVerifications)}
          note={`${activity.sessions} sessions total`}
        />
        <Stat label="Active sessions" value={formatNumber(activity.activeSessions)} />
        <Stat
          label="Package"
          value={subscription?.packageCode?.replace('_', ' ') ?? '—'}
          note={subscription ? subscription.status : 'No subscription'}
        />
      </div>

      {/* two-column layout */}
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        {/* left column */}
        <div className="space-y-5 lg:col-span-1">
          {/* profile card */}
          <Card title="Profile">
            <dl className="space-y-3">
              <Field label="Full name" value={profile.fullName} />
              <Field label="Phone" value={profile.phone} />
              <Field label="Phone verified" value={formatDateTime(profile.phoneVerifiedAt)} />
              <Field label="Google email" value={profile.googleEmail ?? '—'} />
              <Field label="Google linked" value={formatDateTime(profile.googleLinkedAt)} />
              <Field label="Language" value={profile.preferredLanguage || 'en'} />
              <Field label="Joined" value={formatDateTime(profile.createdAt)} />
              <Field label="Last login" value={formatRelative(profile.lastLoginAt)} />
              {profile.deletedAt && <Field label="Deleted" value={formatDateTime(profile.deletedAt)} />}
            </dl>
          </Card>

          {/* PIN & security */}
          <Card title="Security">
            <dl className="space-y-3">
              <Field label="PIN set" value={profile.pin.set ? `Yes — ${formatDate(profile.pin.setAt)}` : 'Not set'} />
              <Field label="Failed attempts" value={String(profile.pin.failedAttempts)} />
              <Field label="PIN locked until" value={profile.pin.lockedUntil ? formatDateTime(profile.pin.lockedUntil) : '—'} />
              <Field label="Biometric" value={profile.pin.biometricEnabled ? 'Enabled' : 'Disabled'} />
            </dl>
          </Card>

          {/* merchant / tenant */}
          {merchant && (
            <Card title={merchant.relation === 'OWNER' ? 'Merchant' : 'Merchant (sub-merchant of)'}>
              <dl className="space-y-3">
                <Field label="Business name" value={merchant.businessName} />
                {merchant.businessType && <Field label="Type" value={merchant.businessType} />}
                {merchant.tin && <Field label="TIN" value={merchant.tin} />}
                {merchant.city && <Field label="City" value={merchant.city} />}
                {merchant.region && <Field label="Region" value={merchant.region} />}
                <Field label="Merchant status" value={<Badge tone={statusTone(merchant.status)}>{merchant.status}</Badge>} />
                <Field label="Credits balance" value={Number(merchant.creditsBalance).toLocaleString('en-GB')} />
                {merchant.branchLabel && <Field label="Branch" value={merchant.branchLabel} />}
                {merchant.subMerchantStatus && (
                  <Field label="Sub-merchant status" value={<Badge tone={statusTone(merchant.subMerchantStatus)}>{merchant.subMerchantStatus}</Badge>} />
                )}
              </dl>
            </Card>
          )}

          {/* subscription */}
          {subscription && (
            <Card title="Subscription">
              <dl className="space-y-3">
                <Field label="Package" value={subscription.packageName ?? subscription.packageCode} />
                <Field label="Status" value={<Badge tone={statusTone(subscription.status)}>{subscription.status}</Badge>} />
                <Field label="Credits / month" value={subscription.unlimited ? 'Unlimited' : formatNumber(subscription.creditsPerMonth)} />
                <Field label="Price" value={formatMoneyMinor(subscription.priceMinor, subscription.currency)} />
                <Field label="Started" value={formatDate(subscription.startedAt)} />
                <Field label="Expires" value={formatDate(subscription.expiresAt)} />
                <Field label="Auto-renew" value={subscription.autoRenew ? 'Yes' : 'No'} />
              </dl>
            </Card>
          )}

          {/* credit summary */}
          {credits.merchantId && (
            <Card title="Credit ledger summary">
              <dl className="space-y-3">
                <Field label="Net balance (ledger)" value={Number(credits.ledgerBalance).toLocaleString('en-GB')} />
                <Field label="Lifetime granted" value={Number(credits.lifetimeGranted).toLocaleString('en-GB')} />
                <Field label="Lifetime consumed" value={Number(credits.lifetimeConsumed).toLocaleString('en-GB')} />
                <Field label="Lifetime refunded" value={Number(credits.lifetimeRefunded).toLocaleString('en-GB')} />
                <Field label="Lifetime expired" value={Number(credits.lifetimeExpired).toLocaleString('en-GB')} />
              </dl>
            </Card>
          )}
        </div>

        {/* right column */}
        <div className="space-y-5 lg:col-span-2">
          {/* verification breakdown */}
          {activity.totalVerifications > 0 && (
            <Card title="Verification breakdown">
              <div className="flex flex-wrap gap-3">
                {Object.entries(activity.verifications).map(([status, count]) => (
                  <div key={status} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-center">
                    <p className="text-lg font-semibold text-slate-900">{count.toLocaleString('en-GB')}</p>
                    <Badge tone={statusTone(status)}>{status}</Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* recent transactions */}
          <Card title="Recent transactions" description="Last 8">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className={TABLE_HEAD}>Bank</th>
                    <th className={TABLE_HEAD}>Reference</th>
                    <th className={TABLE_HEAD}>Amount</th>
                    <th className={TABLE_HEAD}>Status</th>
                    <th className={TABLE_HEAD}>Paid at</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {recentTransactions.length === 0 ? (
                    <EmptyRow colSpan={5}>No transactions yet.</EmptyRow>
                  ) : (
                    recentTransactions.map((tx) => (
                      <tr key={tx.id}>
                        <td className={TABLE_CELL}>{tx.bankCode ?? '—'}</td>
                        <td className={TABLE_CELL}>
                          <span className="font-mono text-xs">{truncate(tx.bankReference, 20)}</span>
                        </td>
                        <td className={TABLE_CELL}>{formatMoneyMinor(tx.amountMinor)}</td>
                        <td className={TABLE_CELL}>
                          <Badge tone={statusTone(tx.status)}>{tx.status}</Badge>
                        </td>
                        <td className={TABLE_CELL}>{formatDateTime(tx.paidAt ?? tx.createdAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* recent verifications */}
          <Card title="Recent verifications" description="Last 8">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className={TABLE_HEAD}>Bank</th>
                    <th className={TABLE_HEAD}>Reference</th>
                    <th className={TABLE_HEAD}>Amount</th>
                    <th className={TABLE_HEAD}>Status</th>
                    <th className={TABLE_HEAD}>Source</th>
                    <th className={TABLE_HEAD}>Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {recentVerifications.length === 0 ? (
                    <EmptyRow colSpan={6}>No verifications yet.</EmptyRow>
                  ) : (
                    recentVerifications.map((v) => (
                      <tr key={v.id}>
                        <td className={TABLE_CELL}>{v.bankCode ?? '—'}</td>
                        <td className={TABLE_CELL}>
                          <span className="font-mono text-xs">{truncate(v.bankReference, 20)}</span>
                        </td>
                        <td className={TABLE_CELL}>{formatMoneyMinor(v.amountMinor)}</td>
                        <td className={TABLE_CELL}>
                          <Badge tone={statusTone(v.status)}>{v.status}</Badge>
                        </td>
                        <td className={TABLE_CELL}>
                          <span className="text-slate-500">{v.source}</span>
                        </td>
                        <td className={TABLE_CELL}>{formatDateTime(v.createdAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* credit ledger rows */}
          {recentCredits.length > 0 && (
            <Card title="Recent credit movements" description="Last 10">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[500px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className={TABLE_HEAD}>Type</th>
                      <th className={TABLE_HEAD}>Amount</th>
                      <th className={TABLE_HEAD}>Balance after</th>
                      <th className={TABLE_HEAD}>Reason</th>
                      <th className={TABLE_HEAD}>By</th>
                      <th className={TABLE_HEAD}>Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {recentCredits.map((cr) => (
                      <tr key={cr.id}>
                        <td className={TABLE_CELL}>
                          <Badge
                            tone={
                              cr.type === 'GRANT' || cr.type === 'REFUND'
                                ? 'green'
                                : cr.type === 'CONSUME' || cr.type === 'EXPIRE'
                                  ? 'amber'
                                  : cr.type === 'ADJUSTMENT'
                                    ? 'blue'
                                    : 'slate'
                            }
                          >
                            {cr.type}
                          </Badge>
                        </td>
                        <td className={TABLE_CELL}>
                          <span className={Number(cr.amount) >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                            {formatSigned(cr.amount)}
                          </span>
                        </td>
                        <td className={TABLE_CELL}>{Number(cr.balanceAfter).toLocaleString('en-GB')}</td>
                        <td className={TABLE_CELL}>{truncate(cr.reason, 32)}</td>
                        <td className={TABLE_CELL}>{cr.actorName ?? cr.actorEmail ?? '—'}</td>
                        <td className={TABLE_CELL}>{formatDateTime(cr.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* devices */}
          <Card title="Trusted devices">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className={TABLE_HEAD}>Platform</th>
                    <th className={TABLE_HEAD}>Model</th>
                    <th className={TABLE_HEAD}>OS / App</th>
                    <th className={TABLE_HEAD}>Last seen</th>
                    <th className={TABLE_HEAD}>Status</th>
                    <th className={TABLE_HEAD}></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {devices.length === 0 ? (
                    <EmptyRow colSpan={6}>No devices registered.</EmptyRow>
                  ) : (
                    devices.map((device) => (
                      <tr key={device.id}>
                        <td className={TABLE_CELL}>{device.platform}</td>
                        <td className={TABLE_CELL}>{device.model ?? '—'}</td>
                        <td className={TABLE_CELL}>
                          <span className="text-slate-500 text-xs">
                            {device.osVersion ?? '—'} / {device.appVersion ?? '—'}
                          </span>
                        </td>
                        <td className={TABLE_CELL}>{formatRelative(device.lastSeenAt)}</td>
                        <td className={TABLE_CELL}>
                          {device.revokedAt ? (
                            <Badge tone="red">Revoked</Badge>
                          ) : (
                            <Badge tone="green">Active</Badge>
                          )}
                        </td>
                        <td className={TABLE_CELL}>
                          {!device.revokedAt && !isAdmin && (
                            <RevokeDeviceButton
                              userId={profile.id}
                              deviceId={device.id}
                              returnTo={returnTo}
                            />
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* audit trail */}
          <Card title="Audit trail" description="Last 10 events on this account">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className={TABLE_HEAD}>Action</th>
                    <th className={TABLE_HEAD}>Target</th>
                    <th className={TABLE_HEAD}>Actor</th>
                    <th className={TABLE_HEAD}>Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {auditTrail.length === 0 ? (
                    <EmptyRow colSpan={4}>No audit events.</EmptyRow>
                  ) : (
                    auditTrail.map((entry) => (
                      <tr key={entry.id}>
                        <td className={TABLE_CELL}>
                          <span className="font-mono text-xs text-slate-700">{entry.action}</span>
                        </td>
                        <td className={TABLE_CELL}>
                          {entry.targetType ? (
                            <span className="text-xs text-slate-500">
                              {entry.targetType}/{truncate(entry.targetId, 8)}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className={TABLE_CELL}>
                          {entry.actorName ?? entry.actorEmail ?? (
                            <span className="text-slate-400">{entry.actorType}</span>
                          )}
                        </td>
                        <td className={TABLE_CELL}>{formatDateTime(entry.createdAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
