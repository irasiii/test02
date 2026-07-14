import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:geny_app/app/modules/auth/auth_controller.dart';
import 'package:geny_app/app/modules/restaurant/home/restaurant_controller.dart';

class RestaurantHomePage extends ConsumerStatefulWidget {
  const RestaurantHomePage({super.key});

  @override
  ConsumerState<RestaurantHomePage> createState() => _RestaurantHomePageState();
}

class _RestaurantHomePageState extends ConsumerState<RestaurantHomePage> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(restaurantControllerProvider.notifier).load());
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(restaurantControllerProvider);
    final restaurant = state.restaurant;

    return Scaffold(
      appBar: AppBar(
        title: Text(restaurant?['name'] as String? ?? 'Restaurant'),
        bottom: const TabBar(
          tabs: [
            Tab(text: 'Orders', icon: Icon(Icons.receipt_long)),
            Tab(text: 'Menu', icon: Icon(Icons.restaurant_menu)),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Log out',
            onPressed: () {
              ref.read(authControllerProvider.notifier).logout();
              context.go('/login');
            },
          ),
        ],
      ),
      body: state.isLoading && restaurant == null
          ? const Center(child: CircularProgressIndicator())
          : state.error != null && restaurant == null
              ? Center(
                  child: Text('Could not load restaurant: ${state.error}'),
                )
              : const TabBarView(
                  children: [
                    _OrdersTab(),
                    _MenuTab(),
                  ],
                ),
    );
  }
}

class _OrdersTab extends ConsumerWidget {
  const _OrdersTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(restaurantControllerProvider);
    if (state.orders.isEmpty) {
      return const Center(child: Text('No incoming orders yet.'));
    }
    return RefreshIndicator(
      onRefresh: () => ref.read(restaurantControllerProvider.notifier).loadOrders(),
      child: ListView.separated(
        padding: const EdgeInsets.all(12),
        itemCount: state.orders.length,
        separatorBuilder: (_, __) => const Divider(),
        itemBuilder: (context, i) {
          final order = Map<String, dynamic>.from(state.orders[i] as Map);
          return _OrderCard(order: order);
        },
      ),
    );
  }
}

class _OrderCard extends ConsumerWidget {
  const _OrderCard({required this.order});

  final Map<String, dynamic> order;

  List<_OrderAction> _actions() {
    final status = (order['status'] as String?) ?? '';
    switch (status) {
      case 'PENDING':
        return [
          _OrderAction('Accept', 'ACCEPTED', Colors.green),
          _OrderAction('Reject', 'REJECTED', Colors.red),
        ];
      case 'ACCEPTED':
        return [_OrderAction('Start preparing', 'PREPARING', Colors.orange)];
      case 'PREPARING':
        return [_OrderAction('Mark ready', 'READY', Colors.blue)];
      default:
        return [];
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final status = (order['status'] as String?) ?? '';
    final total = (order['total'] as num?)?.toDouble() ?? 0;
    final actions = _actions();
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    '#${order['id']?.toString().substring(0, 8) ?? '?'}',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                  ),
                ),
                Chip(
                  label: Text(status),
                  backgroundColor: _statusColor(status).withOpacity(0.15),
                  labelStyle: TextStyle(color: _statusColor(status)),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text('Total: \$${total.toStringAsFixed(2)}'),
            if (order['deliveryAddress'] != null)
              Text('Deliver to: ${order['deliveryAddress']}',
                  style: const TextStyle(color: Colors.black54)),
            if (order['customerNote'] != null && (order['customerNote'] as String).isNotEmpty)
              Text('Note: ${order['customerNote']}',
                  style: const TextStyle(color: Colors.black54)),
            if (actions.isNotEmpty) ...[
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                children: actions
                    .map(
                      (a) => ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: a.color,
                          foregroundColor: Colors.white,
                        ),
                        onPressed: () async {
                          final ok = await ref
                              .read(restaurantControllerProvider.notifier)
                              .updateOrderStatus(order['id'] as String, a.status);
                          if (!ok && context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Action failed')),
                            );
                          }
                        },
                        child: Text(a.label),
                      ),
                    )
                    .toList(),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'PENDING':
        return Colors.grey;
      case 'ACCEPTED':
        return Colors.green;
      case 'PREPARING':
        return Colors.orange;
      case 'READY':
        return Colors.blue;
      case 'REJECTED':
        return Colors.red;
      default:
        return Colors.deepPurple;
    }
  }
}

class _OrderAction {
  const _OrderAction(this.label, this.status, this.color);
  final String label;
  final String status;
  final Color color;
}

class _MenuTab extends ConsumerWidget {
  const _MenuTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(restaurantControllerProvider);
    final items = state.items;
    final categories = state.categories;

    if (items.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text('Your menu is empty.'),
            const SizedBox(height: 12),
            ElevatedButton.icon(
              onPressed: () => _showAddItem(context, ref),
              icon: const Icon(Icons.add),
              label: const Text('Add item'),
            ),
          ],
        ),
      );
    }

    return Stack(
      children: [
        ListView.separated(
          padding: const EdgeInsets.all(12),
          itemCount: items.length,
          separatorBuilder: (_, __) => const Divider(),
          itemBuilder: (context, i) {
            final item = Map<String, dynamic>.from(items[i] as Map);
            final available = (item['isAvailable'] as bool?) == true;
            final categoryId = item['categoryId'] as String?;
            final categoryName = categories.firstWhere(
              (c) => (c as Map)['id'] == categoryId,
              orElse: () => <String, dynamic>{'name': 'Uncategorized'},
            )['name'] as String?;
            return ListTile(
              title: Text(item['name'] as String? ?? ''),
              subtitle: Text(
                '${categoryName ?? ''} • \$${(item['price'] as num?)?.toDouble().toStringAsFixed(2)}\n${item['description'] ?? ''}'
                    .trim(),
              ),
              trailing: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Switch(
                    value: available,
                    onChanged: (v) => ref
                        .read(restaurantControllerProvider.notifier)
                        .setItemAvailability(item['id'] as String, v),
                  ),
                  IconButton(
                    icon: const Icon(Icons.delete_outline, color: Colors.red),
                    onPressed: () => ref
                        .read(restaurantControllerProvider.notifier)
                        .deleteItem(item['id'] as String),
                  ),
                ],
              ),
            );
          },
        ),
        Positioned(
          right: 16,
          bottom: 16,
          child: FloatingActionButton.extended(
            onPressed: () => _showAddItem(context, ref),
            icon: const Icon(Icons.add),
            label: const Text('Add item'),
          ),
        ),
      ],
    );
  }

  Future<void> _showAddItem(BuildContext context, WidgetRef ref) async {
    final categories = ref.read(restaurantControllerProvider).categories;
    final nameCtrl = TextEditingController();
    final priceCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    String? categoryId = categories.isNotEmpty ? (categories.first as Map)['id'] as String? : null;

    await showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Add menu item'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (categories.isEmpty)
                const Text('Create a category first (coming soon).',
                    style: TextStyle(color: Colors.black54)),
              if (categories.isNotEmpty)
                DropdownButtonFormField<String>(
                  value: categoryId,
                  items: categories
                      .map((c) => DropdownMenuItem(
                            value: (c as Map)['id'] as String,
                            child: Text((c)['name'] as String? ?? ''),
                          ))
                      .toList(),
                  onChanged: (v) => categoryId = v,
                  decoration: const InputDecoration(labelText: 'Category'),
                ),
              TextField(
                controller: nameCtrl,
                decoration: const InputDecoration(labelText: 'Name'),
              ),
              TextField(
                controller: priceCtrl,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: 'Price'),
              ),
              TextField(
                controller: descCtrl,
                decoration: const InputDecoration(labelText: 'Description (optional)'),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              final price = double.tryParse(priceCtrl.text);
              if (nameCtrl.text.isEmpty || price == null || categoryId == null) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Name, valid price and category are required')),
                );
                return;
              }
              final ok = await ref.read(restaurantControllerProvider.notifier).addItem(
                    categoryId: categoryId!,
                    name: nameCtrl.text,
                    price: price,
                    description: descCtrl.text,
                  );
              if (context.mounted) Navigator.pop(ctx);
              if (!ok && context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Failed to add item')),
                );
              }
            },
            child: const Text('Add'),
          ),
        ],
      ),
    );
  }
}
