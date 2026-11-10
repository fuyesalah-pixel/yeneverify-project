import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'app.dart';
import 'core/env/app_env.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  AppEnv.validate();
  await Firebase.initializeApp();

  runApp(
    const ProviderScope(
      child: YeneVerifyApp(),
    ),
  );
}
