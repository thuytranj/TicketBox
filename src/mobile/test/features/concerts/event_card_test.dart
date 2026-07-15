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
          onTap: () {},
        )),
      );
      expect(find.text('Summer Vibes Festival'), findsOneWidget);
    });

    testWidgets('renders concert location', (tester) async {
      await tester.pumpWidget(
        _wrap(EventCard(
          concert: _concert,
          onTap: () {},
        )),
      );
      expect(find.text('Đà Nẵng Beach'), findsOneWidget);
    });

    testWidgets('renders location icon', (tester) async {
      await tester.pumpWidget(
        _wrap(EventCard(
          concert: _concert,
          onTap: () {},
        )),
      );
      expect(find.byIcon(Icons.location_on_outlined), findsOneWidget);
    });

    testWidgets('renders chevron right icon for navigation affordance',
        (tester) async {
      await tester.pumpWidget(
        _wrap(EventCard(
          concert: _concert,
          onTap: () {},
        )),
      );
      expect(find.byIcon(Icons.chevron_right_rounded), findsOneWidget);
    });

    // ── No selection state ────────────────────────────────────────────────────

    testWidgets('does not show check_circle icon (no selection state)',
        (tester) async {
      await tester.pumpWidget(
        _wrap(EventCard(
          concert: _concert,
          onTap: () {},
        )),
      );
      expect(find.byIcon(Icons.check_circle_rounded), findsNothing);
    });

    testWidgets('border is always 1dp (no selection-based width)',
        (tester) async {
      await tester.pumpWidget(
        _wrap(EventCard(
          concert: _concert,
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

    // ── Description removed ───────────────────────────────────────────────────

    testWidgets('description text is NOT rendered in card', (tester) async {
      final concertWithDesc = Concert(
        id: 'c-desc',
        title: 'Desc Concert',
        location: 'Venue',
        description: 'A very detailed description that should not appear',
      );
      await tester.pumpWidget(
        _wrap(EventCard(
          concert: concertWithDesc,
          onTap: () {},
        )),
      );
      expect(
        find.text('A very detailed description that should not appear'),
        findsNothing,
      );
    });

    // ── Interaction ───────────────────────────────────────────────────────────

    testWidgets('onTap fires when card is tapped', (tester) async {
      var tapped = false;
      await tester.pumpWidget(
        _wrap(EventCard(
          concert: _concert,
          onTap: () => tapped = true,
        )),
      );

      await tester.tap(find.text('Summer Vibes Festival'));
      await tester.pump();

      expect(tapped, isTrue);
    });

    testWidgets('has minimum height of 72dp', (tester) async {
      await tester.pumpWidget(
        _wrap(EventCard(
          concert: _concert,
          onTap: () {},
        )),
      );

      final container = tester.widget<AnimatedContainer>(
        find.byType(AnimatedContainer).first,
      );
      expect(container.constraints?.minHeight, 72);
    });

    // ── Status chip ───────────────────────────────────────────────────────────

    testWidgets('shows Hôm nay chip for today concert', (tester) async {
      final todayConcert = Concert(
        id: 'today-1',
        title: 'Today Event',
        location: 'Venue',
        startTime: DateTime.now(),
        status: 'active',
      );
      await tester.pumpWidget(
        _wrap(EventCard(
          concert: todayConcert,
          onTap: () {},
        )),
      );
      expect(find.text('Hôm nay'), findsOneWidget);
    });

    testWidgets('shows Đã diễn ra chip for completed concert', (tester) async {
      final pastConcert = Concert(
        id: 'past-1',
        title: 'Past Event',
        location: 'Venue',
        startTime: DateTime.now().subtract(const Duration(days: 2)),
        endTime: DateTime.now().subtract(const Duration(days: 1)),
        status: 'completed',
      );
      await tester.pumpWidget(
        _wrap(EventCard(
          concert: pastConcert,
          onTap: () {},
        )),
      );
      expect(find.text('Đã diễn ra'), findsOneWidget);
    });

    testWidgets('no status chip for future concert', (tester) async {
      final futureConcert = Concert(
        id: 'future-1',
        title: 'Future Event',
        location: 'Venue',
        startTime: DateTime.now().add(const Duration(days: 5)),
        status: 'active',
      );
      await tester.pumpWidget(
        _wrap(EventCard(
          concert: futureConcert,
          onTap: () {},
        )),
      );
      expect(find.text('Hôm nay'), findsNothing);
      expect(find.text('Đã diễn ra'), findsNothing);
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
