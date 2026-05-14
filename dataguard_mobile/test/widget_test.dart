import 'package:flutter_test/flutter_test.dart';
import 'package:dataguard_mobile/app.dart';

void main() {
  testWidgets('App renders', (WidgetTester tester) async {
    await tester.pumpWidget(const DataGuardApp());
    expect(find.text('DataGuard AI'), findsOneWidget);
  });
}
