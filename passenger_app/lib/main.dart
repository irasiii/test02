import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_stripe/flutter_stripe.dart';

import 'app/core/constants/app_constants.dart';
import 'app/core/router/app_router.dart';
import 'app/core/theme/app_theme.dart';
import 'app/data/providers/providers.dart';
import 'app/modules/auth/auth_controller.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Firebase (push notifications). Optional — app runs without it.
  try {
    await Firebase.initializeApp();
    FirebaseMessaging.onBackgroundMessage(_backgroundHandler);
  } catch (_) {
    // Firebase not configured — push notifications disabled. App still runs.
  }

  // Stripe (payments). Only initialised when a publishable key is provided;
  // otherwise the app runs in demo mode and checkout proceeds without a real
  // client-side confirmation step.
  if (AppConstants.stripePublishableKey.isNotEmpty) {
    try {
      Stripe.publishableKey = AppConstants.stripePublishableKey;
    } catch (_) {
      // Ignore — payment sheet will be skipped at checkout.
    }
  }

  runApp(const ProviderScope(child: GenYApp()));
}

@pragma('vm:entry-point')
Future<void> _backgroundHandler(RemoteMessage message) async {
  // Required for background notifications. Backend sends via FCM admin SDK.
  debugPrint('[FCM] background message: ${message.messageId}');
}

/// Registers the device's FCM token with the backend so the server can target
/// this user with push notifications. The token is persisted locally and
/// re-sent whenever the user is authenticated or the token rotates.
class FcmRegistrar extends ConsumerStatefulWidget {
  const FcmRegistrar({super.key, required this.child});
  final Widget child;

  @override
  ConsumerState<FcmRegistrar> createState() => _FcmRegistrarState();
}

class _FcmRegistrarState extends ConsumerState<FcmRegistrar> {
  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    try {
      final messaging = FirebaseMessaging.instance;
      final token = await messaging.getToken();
      if (token != null) await _push(token);

      // Re-register when Firebase rotates the token.
      messaging.onTokenRefresh.listen((token) => _push(token));

      // Surface foreground pushes as a simple in-app banner.
      FirebaseMessaging.onMessage.listen((message) {
        final notification = message.notification;
        if (notification == null || !mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(notification.title ?? 'New notification')),
        );
      });
    } catch (_) {
      // Firebase unavailable (e.g. not configured) — skip silently.
    }
  }

  Future<void> _push(String token) async {
    final storage = ref.read(secureStorageProvider);
    await storage.writeFcmToken(token);
    final auth = ref.read(authControllerProvider);
    if (!auth.isAuthenticated) return;
    try {
      await ref.read(apiClientProvider).updateProfile({'fcmToken': token});
    } catch (_) {
      // Token will be retried on next refresh or login.
    }
  }

  @override
  Widget build(BuildContext context) => widget.child;
}

class GenYApp extends ConsumerWidget {
  const GenYApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    return MaterialApp.router(
      title: 'GenY — Ride & Food',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      routerConfig: router,
      builder: (context, child) => FcmRegistrar(child: child ?? const SizedBox.shrink()),
    );
  }
}
