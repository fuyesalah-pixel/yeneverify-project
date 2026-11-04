import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Active UI locale. null follows the device locale (falling back to the
/// first supported locale, English). The Profile tab's EN/AM toggle writes
/// here; MaterialApp.router reads it.
final localeProvider = StateProvider<Locale?>((ref) => null);
