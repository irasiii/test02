import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:geny_app/app/modules/auth/auth_controller.dart';

/// Minimal shell for the ADMIN role. The full admin console (users, drivers,
/// restaurants, payments) is served by the web dashboard; this screen gives
/// the role a valid, non-crashing home in the app.
class AdminHomePage extends ConsumerWidget {
  const AdminHomePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authControllerProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Admin')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          CircleAvatar(
            radius: 36,
            backgroundColor: Theme.of(context).colorScheme.surface,
            child: const Icon(Icons.admin_panel_settings, size: 36, color: Colors.deepOrange),
          ),
          const SizedBox(height: 12),
          Text(auth.fullName ?? 'Administrator',
              textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 4),
          Text(auth.email ?? '', textAlign: TextAlign.center, style: const TextStyle(color: Colors.black54)),
          const SizedBox(height: 24),
          const Card(
            child: ListTile(
              leading: Icon(Icons.dashboard_outlined),
              title: Text('Operations dashboard'),
              subtitle: Text('Open the GenY admin console to manage users, drivers, and payments.'),
            ),
          ),
          const SizedBox(height: 16),
          ListTile(
            leading: const Icon(Icons.logout, color: Colors.red),
            title: const Text('Log out', style: TextStyle(color: Colors.red)),
            onTap: () {
              ref.read(authControllerProvider.notifier).logout();
              context.go('/login');
            },
          ),
        ],
      ),
    );
  }
}
