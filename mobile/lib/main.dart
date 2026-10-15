import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'app.dart';
import 'core/env/app_env.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  AppEnv.validate();

  runApp(
    const ProviderScope(
      child: YeneVerifyApp(),
    ),
  );
}
