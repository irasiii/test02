import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Simple in-memory cart state. Reset on restaurant change.
class CartItem {
  CartItem(this.id, this.name, this.price, this.quantity);

  final String id;
  final String name;
  final double price;
  final int quantity;

  double get subtotal => price * quantity;

  CartItem increment() => CartItem(id, name, price, quantity + 1);
  CartItem decrement() => CartItem(id, name, price, quantity - 1);

  Map<String, dynamic> toApiItem() => {'menuItemId': id, 'quantity': quantity};
}

class CartState {
  CartState({this.items = const []});
  final List<CartItem> items;

  double get subtotal => items.fold(0.0, (s, i) => s + i.price * i.quantity);
  int get itemCount => items.fold(0, (n, i) => n + i.quantity);
  CartState copyWith(List<CartItem> items) => CartState(items: items);
}

class FoodCartController extends StateNotifier<CartState> {
  FoodCartController() : super(CartState());

  void reset() => state = CartState();

  void addItem({required String id, required String name, required double price}) {
    final items = [...state.items];
    final existing = items.indexWhere((i) => i.id == id);
    if (existing == -1) {
      items.add(CartItem(id, name, price, 1));
    } else {
      items[existing] = items[existing].increment();
    }
    state = CartState(items: items);
  }

  void decrementItem(String id) {
    final items = [...state.items];
    final idx = items.indexWhere((i) => i.id == id);
    if (idx == -1) return;
    if (items[idx].quantity <= 1) {
      items.removeAt(idx);
    } else {
      items[idx] = items[idx].decrement();
    }
    state = CartState(items: items);
  }
}

final foodCartProvider = StateNotifierProvider<FoodCartController, CartState>((ref) {
  return FoodCartController();
});
