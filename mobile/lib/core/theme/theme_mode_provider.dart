import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Global theme mode state.
///
/// `system` respects the OS setting; the design-system showcase toggles
/// between [ThemeMode.light] and [ThemeMode.dark] for instant comparison.
final themeModeProvider = StateProvider<ThemeMode>((ref) => ThemeMode.system);
