import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../auth/auth_controller.dart';

class SplashPage extends ConsumerWidget {
  const SplashPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authControllerProvider);

    // On the first frame when state resolved, route forward.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!auth.isLoading) {
        if (auth.isAuthenticated && auth.role != null) {
          context.go(auth.homePath);
        } else {
          context.go('/login');
        }
      }
    });

    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.primary,
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.local_taxi, size: 80, color: Colors.white),
            const SizedBox(height: 16),
            const Text('GenY', style: TextStyle(fontSize: 36, fontWeight: FontWeight.bold, color: Colors.white)),
            const SizedBox(height: 8),
            Text('Ride & Food', style: TextStyle(fontSize: 16, color: Colors.white.withOpacity(0.8))),
            const SizedBox(height: 60),
            const CircularProgressIndicator(color: Colors.white),
          ],
        ),
      ),
    );
  }
}
