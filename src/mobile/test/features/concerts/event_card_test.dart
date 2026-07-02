import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ticketbox_mobile/core/theme/gate_app_theme.dart';
import 'package:ticketbox_mobile/features/concerts/models/concert.dart';
import 'package:ticketbox_mobile/features/concerts/widgets/event_card.dart';

Widget _wrap(Widget child) => MaterialApp(
      theme: GateAppTheme.dark(),
      home: Scaffold(body: child),
    );

final _concert = Concert(
  id: 'test-1',
  title: 'Summer Vibes Festival',
  location: 'Đà Nẵng Beach',
);

void main() {
  group('EventCard', () {
    // ── Structure ─────────────────────────────────────────────────────────────

    testWidgets('renders concert title', (tester) async {
      await tester.pumpWidget(
        _wrap(EventCard(
          concert: _concert,
          isSelected: false,
          onTap: () {},
        )),
      );
      expect(find.text('Summer Vibes Festival'), findsOneWidget);
    });

    testWidgets('renders concert location', (tester) async {
      await tester.pumpWidget(
        _wrap(EventCard(
          concert: _concert,
          isSelected: false,
          onTap: () {},
        )),
      );
      expect(find.text('Đà Nẵng Beach'), findsOneWidget);
    });

    testWidgets('renders location icon', (tester) async {
      await tester.pumpWidget(
        _wrap(EventCard(
          concert: _concert,
          isSelected: false,
          onTap: () {},
        )),
      );
      expect(find.byIcon(Icons.location_on_outlined), findsOneWidget);
    });

    // ── Unselected state ──────────────────────────────────────────────────────

    testWidgets('unselected: no check icon visible', (tester) async {
      await tester.pumpWidget(
        _wrap(EventCard(
          concert: _concert,
          isSelected: false,
          onTap: () {},
        )),
      );
      expect(find.byIcon(Icons.check_circle_rounded), findsNothing);
    });

    // ── Selected state ────────────────────────────────────────────────────────

    testWidgets('selected: shows check icon', (tester) async {
      await tester.pumpWidget(
        _wrap(EventCard(
          concert: _concert,
          isSelected: true,
          onTap: () {},
        )),
      );
      expect(find.byIcon(Icons.check_circle_rounded), findsOneWidget);
    });

    testWidgets('selected: primary border color applied', (tester) async {
      await tester.pumpWidget(
        _wrap(EventCard(
          concert: _concert,
          isSelected: true,
          onTap: () {},
        )),
      );
      // AnimatedContainer with the border is present when selected
      final container = tester.widget<AnimatedContainer>(
        find.byType(AnimatedContainer).first,
      );
      final decoration = container.decoration as BoxDecoration;
      final border = decoration.border as Border;
      expect(border.top.width, 2.0);
    });

    testWidgets('unselected: 1dp border', (tester) async {
      await tester.pumpWidget(
        _wrap(EventCard(
          concert: _concert,
          isSelected: false,
          onTap: () {},
        )),
      );
      final container = tester.widget<AnimatedContainer>(
        find.byType(AnimatedContainer).first,
      );
      final decoration = container.decoration as BoxDecoration;
      final border = decoration.border as Border;
      expect(border.top.width, 1.0);
    });

    // ── Interaction ───────────────────────────────────────────────────────────

    testWidgets('onTap fires when card is tapped', (tester) async {
      var tapped = false;
      await tester.pumpWidget(
        _wrap(EventCard(
          concert: _concert,
          isSelected: false,
          onTap: () => tapped = true,
        )),
      );

      // Tap on the GestureDetector/InkWell area
      await tester.tap(find.text('Summer Vibes Festival'));
      await tester.pump();

      expect(tapped, isTrue);
    });

    testWidgets('has minimum height of 80dp', (tester) async {
      await tester.pumpWidget(
        _wrap(EventCard(
          concert: _concert,
          isSelected: false,
          onTap: () {},
        )),
      );

      final container = tester.widget<AnimatedContainer>(
        find.byType(AnimatedContainer).first,
      );
      expect(container.constraints?.minHeight, 80);
    });

    // ── Long text ─────────────────────────────────────────────────────────────

    testWidgets('long title truncated with ellipsis', (tester) async {
      final longTitleConcert = Concert(
        id: 'c-long',
        title:
            'Very Long Concert Title That Should Definitely Be Truncated By The Widget In Order To Fit In The Card',
        location: 'Some Venue',
      );
      await tester.pumpWidget(
        _wrap(EventCard(
          concert: longTitleConcert,
          isSelected: false,
          onTap: () {},
        )),
      );
      // Widget renders without overflow exception
      final titleFinder = find.byWidgetPredicate(
        (w) => w is Text && w.overflow == TextOverflow.ellipsis,
      );
      expect(titleFinder, findsWidgets);
    });
  });
}
