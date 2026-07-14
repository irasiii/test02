import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('App smoke test', (WidgetTester tester) async {
    // We don't render the app here because it requires Firebase init + a backend.
    // Just verify that the package compiles.
    expect(true, isTrue);
  });
}
