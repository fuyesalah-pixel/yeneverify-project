import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:yene_verify/features/dashboard/domain/relative_time.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late AppLocalizations l10n;
  final now = DateTime(2026, 11, 3, 12, 0);

  setUpAll(() async {
    l10n = await AppLocalizations.delegate.load(const Locale('en'));
  });

  String at(Duration ago) => relativeTime(now.subtract(ago), l10n, now: now);

  test('null renders an em dash', () {
    expect(relativeTime(null, l10n, now: now), '—');
  });

  test('under a minute is "Just now"', () {
    expect(at(const Duration(seconds: 30)), 'Just now');
  });

  test('minutes', () {
    expect(at(const Duration(minutes: 5)), '5m ago');
    expect(at(const Duration(minutes: 59)), '59m ago');
  });

  test('hours', () {
    expect(at(const Duration(hours: 1)), '1h ago');
    expect(at(const Duration(hours: 23)), '23h ago');
  });

  test('yesterday is a word, not "1d ago"', () {
    expect(at(const Duration(days: 1)), 'Yesterday');
  });

  test('two to six days use the day count', () {
    expect(at(const Duration(days: 2)), '2d ago');
    expect(at(const Duration(days: 6)), '6d ago');
  });

  test('a week or more falls back to a date', () {
    expect(at(const Duration(days: 10)), 'Oct 24, 2026');
  });

  test('a future timestamp never renders negative time', () {
    expect(
      relativeTime(now.add(const Duration(minutes: 5)), l10n, now: now),
      'Just now',
    );
  });
}
