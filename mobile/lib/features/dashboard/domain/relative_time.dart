// "2h ago", "Yesterday", "3d ago" — the dashboard's time voice.
//
// Kept pure (clock injected) so the branch table is unit-testable without
// faking the system time.
import 'package:intl/intl.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

String relativeTime(
  DateTime? then,
  AppLocalizations l10n, {
  DateTime? now,
}) {
  if (then == null) return '—';
  final current = now ?? DateTime.now();
  final diff = current.difference(then.toLocal());

  if (diff.isNegative || diff.inSeconds < 60) return l10n.relativeTimeJustNow;
  if (diff.inMinutes < 60) return l10n.relativeTimeMinutes(diff.inMinutes);
  if (diff.inHours < 24) return l10n.relativeTimeHours(diff.inHours);
  if (diff.inDays == 1) return l10n.relativeTimeYesterday;
  if (diff.inDays < 7) return l10n.relativeTimeDays(diff.inDays);
  return DateFormat.yMMMd().format(then.toLocal());
}
