import 'package:flutter/foundation.dart' show immutable;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:geny_app/app/core/errors/failures.dart';
import 'package:geny_app/app/data/providers/providers.dart';
import 'package:geny_app/app/data/services/api_client.dart';

/// Drives the restaurant partner console: loads the owner's restaurant,
/// incoming orders, and menu, and exposes mutation actions (order status,
/// item create/update/delete, category create/delete).
class RestaurantController extends StateNotifier<RestaurantState> {
  RestaurantController(this._api) : super(const RestaurantState());

  final ApiClient _api;

  String? get _restaurantId => state.restaurant?['id'] as String?;

  Future<void> load() async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final restaurant = await _api.getMyRestaurant();
      if (!mounted) return;
      state = state.copyWith(restaurant: restaurant, isLoading: false);
      await Future.wait([loadOrders(), loadMenu()]);
    } on AppFailure catch (e) {
      if (mounted) state = state.copyWith(isLoading: false, error: e);
    } catch (e) {
      if (mounted) state = state.copyWith(isLoading: false, error: AppFailure.serverError(e.toString()));
    }
  }

  Future<void> loadOrders() async {
    final rid = _restaurantId;
    if (rid == null) return;
    try {
      final orders = await _api.listRestaurantOrders(rid);
      if (!mounted) return;
      state = state.copyWith(orders: orders);
    } on AppFailure catch (e) {
      if (mounted) state = state.copyWith(error: e);
    } catch (e) {
      if (mounted) state = state.copyWith(error: AppFailure.serverError(e.toString()));
    }
  }

  Future<void> loadMenu() async {
    final rid = _restaurantId;
    if (rid == null) return;
    try {
      final results = await Future.wait([
        _api.listMenuCategories(rid),
        _api.listMenuItems(rid),
      ]);
      if (!mounted) return;
      state = state.copyWith(categories: results[0], items: results[1]);
    } on AppFailure catch (e) {
      if (mounted) state = state.copyWith(error: e);
    } catch (e) {
      if (mounted) state = state.copyWith(error: AppFailure.serverError(e.toString()));
    }
  }

  Future<bool> updateOrderStatus(String orderId, String status, {String? cancelReason}) async {
    try {
      await _api.updateOrderStatus(orderId, status, cancelReason: cancelReason);
      await loadOrders();
      return true;
    } on AppFailure catch (e) {
      if (mounted) state = state.copyWith(error: e);
      return false;
    } catch (e) {
      if (mounted) state = state.copyWith(error: AppFailure.serverError(e.toString()));
      return false;
    }
  }

  Future<bool> addItem({
    required String categoryId,
    required String name,
    required double price,
    String? description,
  }) async {
    final rid = _restaurantId;
    if (rid == null) return false;
    try {
      await _api.createMenuItem(rid, {
        'categoryId': categoryId,
        'name': name,
        'price': price,
        if (description != null && description.isNotEmpty) 'description': description,
        'isAvailable': true,
      });
      await loadMenu();
      return true;
    } on AppFailure catch (e) {
      if (mounted) state = state.copyWith(error: e);
      return false;
    } catch (e) {
      if (mounted) state = state.copyWith(error: AppFailure.serverError(e.toString()));
      return false;
    }
  }

  Future<bool> setItemAvailability(String itemId, bool isAvailable) async {
    final rid = _restaurantId;
    if (rid == null) return false;
    try {
      await _api.updateMenuItem(rid, itemId, {'isAvailable': isAvailable});
      await loadMenu();
      return true;
    } on AppFailure catch (e) {
      if (mounted) state = state.copyWith(error: e);
      return false;
    } catch (e) {
      if (mounted) state = state.copyWith(error: AppFailure.serverError(e.toString()));
      return false;
    }
  }

  Future<bool> deleteItem(String itemId) async {
    final rid = _restaurantId;
    if (rid == null) return false;
    try {
      await _api.deleteMenuItem(rid, itemId);
      await loadMenu();
      return true;
    } on AppFailure catch (e) {
      if (mounted) state = state.copyWith(error: e);
      return false;
    } catch (e) {
      if (mounted) state = state.copyWith(error: AppFailure.serverError(e.toString()));
      return false;
    }
  }

  Future<bool> addCategory(String name) async {
    final rid = _restaurantId;
    if (rid == null) return false;
    try {
      await _api.createCategory(rid, {'name': name});
      await loadMenu();
      return true;
    } on AppFailure catch (e) {
      if (mounted) state = state.copyWith(error: e);
      return false;
    } catch (e) {
      if (mounted) state = state.copyWith(error: AppFailure.serverError(e.toString()));
      return false;
    }
  }

  Future<bool> deleteCategory(String categoryId) async {
    final rid = _restaurantId;
    if (rid == null) return false;
    try {
      await _api.deleteCategory(rid, categoryId);
      await loadMenu();
      return true;
    } on AppFailure catch (e) {
      if (mounted) state = state.copyWith(error: e);
      return false;
    } catch (e) {
      if (mounted) state = state.copyWith(error: AppFailure.serverError(e.toString()));
      return false;
    }
  }

  void clearError() => state = state.copyWith(clearError: true);
}

final restaurantControllerProvider =
    StateNotifierProvider<RestaurantController, RestaurantState>((ref) {
  return RestaurantController(ref.watch(apiClientProvider));
});

@immutable
class RestaurantState {
  const RestaurantState({
    this.isLoading = false,
    this.error,
    this.restaurant,
    this.orders = const [],
    this.categories = const [],
    this.items = const [],
  });

  final bool isLoading;
  final AppFailure? error;
  final Map<String, dynamic>? restaurant;
  final List<dynamic> orders;
  final List<dynamic> categories;
  final List<dynamic> items;

  RestaurantState copyWith({
    bool? isLoading,
    AppFailure? error,
    Map<String, dynamic>? restaurant,
    List<dynamic>? orders,
    List<dynamic>? categories,
    List<dynamic>? items,
    bool clearError = false,
  }) {
    return RestaurantState(
      isLoading: isLoading ?? this.isLoading,
      error: clearError ? null : (error ?? this.error),
      restaurant: restaurant ?? this.restaurant,
      orders: orders ?? this.orders,
      categories: categories ?? this.categories,
      items: items ?? this.items,
    );
  }
}
