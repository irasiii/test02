import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:geny_app/app/data/models/app_role.dart';
import 'package:geny_app/app/modules/auth/auth_controller.dart';

class ProfilePage extends ConsumerWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authControllerProvider);
    final role = auth.role;
    return Scaffold(
      appBar: AppBar(title: const Text('My profile')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Center(
            child: CircleAvatar(
              radius: 48,
              backgroundColor: Colors.white,
              child: Icon(Icons.person, size: 48, color: Theme.of(context).colorScheme.primary),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            auth.fullName ?? 'GenY user',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 4),
          Text(
            auth.email ?? '',
            textAlign: TextAlign.center,
            style: const TextStyle(color: Colors.black54),
          ),
          if (role != null)
            Center(child: Chip(label: Text(role.label), padding: const EdgeInsets.symmetric(horizontal: 8))),
          const SizedBox(height: 24),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.directions_car_outlined),
            title: Text(role == AppRole.DRIVER ? 'My trips log' : 'My ride history'),
            onTap: () => context.go('/passenger/rides'),
            trailing: const Icon(Icons.arrow_forward_ios, size: 16),
          ),
          if (role == AppRole.CUSTOMER)
            ListTile(
              leading: const Icon(Icons.restaurant_menu),
              title: const Text('My order history'),
              onTap: () => context.go('/passenger/orders'),
              trailing: const Icon(Icons.arrow_forward_ios, size: 16),
            ),
          ListTile(
            leading: const Icon(Icons.support_agent),
            title: const Text('Help & support'),
            onTap: () => ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Contact support: support@geny.app')),
            ),
            trailing: const Icon(Icons.arrow_forward_ios, size: 16),
          ),
          const Divider(),
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
