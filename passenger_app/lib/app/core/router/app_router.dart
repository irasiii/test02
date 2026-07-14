import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:geny_app/app/data/models/app_role.dart';
import 'package:geny_app/app/modules/auth/auth_controller.dart';
import 'package:geny_app/app/modules/auth/pages/login_page.dart';
import 'package:geny_app/app/modules/auth/pages/register_page.dart';
import 'package:geny_app/app/modules/auth/pages/splash_page.dart';
import 'package:geny_app/app/modules/driver/home/driver_home_page.dart';
import 'package:geny_app/app/modules/passenger/home/passenger_home_page.dart';
import 'package:geny_app/app/modules/restaurant/home/restaurant_home_page.dart';
import 'package:geny_app/app/modules/admin/home/admin_home_page.dart';
import 'package:geny_app/app/modules/shared/profile/profile_page.dart';
import 'package:geny_app/app/modules/shared/history/history_page.dart';
import 'package:geny_app/app/modules/shared/history/history_controller.dart';

/// Router outlet that:
///  1. Gates access to authenticated routes.
///  2. Redirects customers to the passenger shell and drivers to the driver shell.
///  3. Allows roles to navigate into each other's shells only when explicitly needed.
final routerProvider = Provider<GoRouter>((ref) {
  final auth = ref.watch(authControllerProvider);

  return GoRouter(
    initialLocation: '/splash',
    refreshListenable: _AuthListenable(ref),
    redirect: (context, state) {
      final isAuthenticated = auth.isAuthenticated;
      final isLoading = auth.isLoading;
      final path = state.matchedLocation;

      // Always allow splash; redirect later once bootstrap finishes.
      if (path == '/splash') {
        if (!isAuthenticated && !isLoading) return '/login';
        if (isAuthenticated && auth.role != null) {
          return auth.isDriver ? '/driver' : '/passenger';
        }
        return null;
      }

      if (!isAuthenticated && !path.startsWith('/login') && !path.startsWith('/register')) {
        return '/login';
      }

      if ((path == '/login' || path == '/register') && isAuthenticated) {
        return auth.homePath;
      }

      // Lock role-specific shells to the appropriate role.
      const protectedShells = {
        '/driver': AppRole.DRIVER,
        '/passenger': AppRole.CUSTOMER,
        '/restaurant': AppRole.RESTAURANT,
        '/admin': AppRole.ADMIN,
      };
      for (final entry in protectedShells.entries) {
        if (path.startsWith(entry.key) && auth.role != entry.value && isAuthenticated) {
          return auth.homePath;
        }
      }

      return null;
    },
    routes: [
      GoRoute(path: '/splash', builder: (_, __) => const SplashPage()),
      GoRoute(path: '/login', builder: (_, __) => const LoginPage()),
      GoRoute(path: '/register', builder: (_, __) => const RegisterPage()),
      ShellRoute(
        builder: (context, state, child) => _PassengerShell(child: child, currentIndex: _passengerIndex(state.matchedLocation)),
        routes: [
          GoRoute(
            path: '/passenger',
            pageBuilder: (_, __) => const NoTransitionPage(child: PassengerHomePage()),
          ),
          GoRoute(
            path: '/passenger/rides',
            pageBuilder: (_, __) => const NoTransitionPage(child: HistoryPage(type: HistoryType.trips)),
          ),
          GoRoute(
            path: '/passenger/orders',
            pageBuilder: (_, __) => const NoTransitionPage(child: HistoryPage(type: HistoryType.orders)),
          ),
          GoRoute(
            path: '/passenger/profile',
            pageBuilder: (_, __) => const NoTransitionPage(child: const ProfilePage()),
          ),
        ],
      ),
      ShellRoute(
        builder: (context, state, child) => _DriverShell(child: child, currentIndex: _driverIndex(state.matchedLocation)),
        routes: [
          GoRoute(
            path: '/driver',
            pageBuilder: (_, __) => const NoTransitionPage(child: DriverHomePage()),
          ),
          GoRoute(
            path: '/driver/deliveries',
            pageBuilder: (_, __) => const NoTransitionPage(child: HistoryPage(type: HistoryType.deliveries)),
          ),
          GoRoute(
            path: '/driver/profile',
            pageBuilder: (_, __) => const NoTransitionPage(child: const ProfilePage()),
          ),
        ],
      ),
      GoRoute(
        path: '/restaurant',
        builder: (_, __) => const RestaurantHomePage(),
      ),
      GoRoute(
        path: '/admin',
        builder: (_, __) => const AdminHomePage(),
      ),
    ],
  );
});

int _passengerIndex(String path) {
  if (path.startsWith('/passenger/rides')) return 1;
  if (path.startsWith('/passenger/orders')) return 2;
  if (path.startsWith('/passenger/profile')) return 3;
  return 0;
}

int _driverIndex(String path) {
  if (path.startsWith('/driver/deliveries')) return 1;
  if (path.startsWith('/driver/profile')) return 2;
  return 0;
}

class _PassengerShell extends StatelessWidget {
  const _PassengerShell({required this.child, required this.currentIndex});
  final Widget child;
  final int currentIndex;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(child: child),
      bottomNavigationBar: NavigationBar(
        selectedIndex: currentIndex,
        onDestinationSelected: (i) {
          switch (i) {
            case 0: context.go('/passenger'); break;
            case 1: context.go('/passenger/rides'); break;
            case 2: context.go('/passenger/orders'); break;
            case 3: context.go('/passenger/profile'); break;
          }
        },
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'Home'),
          NavigationDestination(icon: Icon(Icons.directions_car_outlined), selectedIcon: Icon(Icons.directions_car), label: 'Rides'),
          NavigationDestination(icon: Icon(Icons.restaurant_outlined), selectedIcon: Icon(Icons.restaurant), label: 'Orders'),
          NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'Profile'),
        ],
      ),
    );
  }
}

class _DriverShell extends StatelessWidget {
  const _DriverShell({required this.child, required this.currentIndex});
  final Widget child;
  final int currentIndex;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(child: child),
      bottomNavigationBar: NavigationBar(
        selectedIndex: currentIndex,
        onDestinationSelected: (i) {
          switch (i) {
            case 0: context.go('/driver'); break;
            case 1: context.go('/driver/deliveries'); break;
            case 2: context.go('/driver/profile'); break;
          }
        },
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'Home'),
          NavigationDestination(icon: Icon(Icons.delivery_dining_outlined), selectedIcon: Icon(Icons.delivery_dining), label: 'Jobs'),
          NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'Profile'),
        ],
      ),
    );
  }
}

class _AuthListenable extends ChangeNotifier {
  _AuthListenable(this._ref) {
    _sub = _ref.listen<AuthState>(authControllerProvider, (_, __) => notifyListeners());
  }
  final Ref _ref;
  late final ProviderSubscription<AuthState> _sub;
  @override
  void dispose() {
    _sub.close();
    super.dispose();
  }
}
