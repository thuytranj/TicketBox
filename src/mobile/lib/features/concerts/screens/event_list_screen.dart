import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/gate_colors.dart';
import '../../../core/theme/gate_spacing.dart';
import '../../../shared/widgets/gate_button.dart';
import '../../../shared/widgets/gate_empty_state.dart';
import '../../../shared/widgets/gate_error_state.dart';
import '../../../shared/widgets/gate_loading_state.dart';
import '../../../shared/widgets/gate_scaffold.dart';
import '../../auth/providers/auth_provider.dart';
import '../models/concert.dart';
import '../providers/concert_provider.dart';
import '../widgets/event_card.dart';
import '../../checkin/screens/preload_screen.dart';

class EventListScreen extends StatefulWidget {
  const EventListScreen({super.key});

  @override
  State<EventListScreen> createState() => _EventListScreenState();
}

class _EventListScreenState extends State<EventListScreen> {
  // Approximate height of bottom CTA bar (padding + button + bottom safe area).
  static const double _ctaBarHeight = 88.0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<ConcertProvider>().fetchConcerts();
    });
  }

  // ── Business logic (unchanged) ─────────────────────────────────────────────

  void _navigateToNext() {
    final concert = context.read<ConcertProvider>().selectedConcert;
    if (concert == null) return;

    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => PreloadScreen(concert: concert),
    ));
  }

  // ── Error helpers ──────────────────────────────────────────────────────────

  GateErrorType _resolveErrorType(String message) {
    final lower = message.toLowerCase();
    if (lower.contains('socketexception') ||
        lower.contains('network') ||
        lower.contains('dioexception') ||
        lower.contains('connection')) {
      return GateErrorType.network;
    }
    return GateErrorType.server;
  }

  String _resolveErrorMessage(String raw) {
    final lower = raw.toLowerCase();
    if (lower.contains('socketexception') ||
        lower.contains('network') ||
        lower.contains('dioexception') ||
        lower.contains('connection')) {
      return 'Không thể tải dữ liệu. Kiểm tra kết nối mạng và thử lại.';
    }
    if (lower.contains('401') || lower.contains('unauthorized')) {
      return 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.';
    }
    if (lower.contains('404') || lower.contains('not found')) {
      return 'Không tìm thấy dữ liệu sự kiện từ server.';
    }
    return 'Đã có lỗi xảy ra. Vui lòng thử lại.';
  }

  // ── Body builder ───────────────────────────────────────────────────────────

  Widget _buildBody(ConcertProvider provider) {
    switch (provider.state) {
      case ConcertState.initial:
      case ConcertState.loading:
        return const GateLoadingState(message: 'Đang tải danh sách sự kiện...');

      case ConcertState.error:
        return GateErrorState(
          message: _resolveErrorMessage(provider.errorMessage),
          type: _resolveErrorType(provider.errorMessage),
          onRetry: provider.fetchConcerts,
        );

      case ConcertState.loaded:
        if (provider.concerts.isEmpty) {
          return const GateEmptyState(
            icon: Icons.event_busy_outlined,
            message: 'Hiện không có sự kiện đang mở để soát vé.',
          );
        }
        return _buildConcertList(provider);
    }
  }

  Widget _buildConcertList(ConcertProvider provider) {
    return RefreshIndicator(
      color: GateColors.primary,
      backgroundColor: GateColors.surface,
      onRefresh: provider.fetchConcerts,
      child: ListView.separated(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: EdgeInsets.fromLTRB(
          GateSpacing.md,
          GateSpacing.md,
          GateSpacing.md,
          // Extra bottom padding so last item is never hidden by CTA bar
          _ctaBarHeight + GateSpacing.md,
        ),
        itemCount: provider.concerts.length,
        separatorBuilder: (context, index) => GateSpacing.vertical(GateSpacing.sm),
        itemBuilder: (context, index) {
          final concert = provider.concerts[index];
          final isSelected = provider.selectedConcert?.id == concert.id;

          return EventCard(
            key: ValueKey(concert.id),
            concert: concert,
            isSelected: isSelected,
            onTap: () => provider.selectConcert(concert),
          );
        },
      ),
    );
  }

  // ── Sticky bottom CTA ──────────────────────────────────────────────────────

  Widget _buildBottomCta(Concert? selected) {
    final hasSelection = selected != null;

    return Container(
      decoration: BoxDecoration(
        color: GateColors.surface,
        border: const Border(
          top: BorderSide(color: GateColors.border, width: 1),
        ),
      ),
      padding: EdgeInsets.fromLTRB(
        GateSpacing.md,
        GateSpacing.sm,
        GateSpacing.md,
        GateSpacing.sm + MediaQuery.of(context).padding.bottom,
      ),
      child: GateButton(
        key: const Key('confirm_cta'),
        label: hasSelection
            ? 'Xác nhận: ${selected.title}'
            : 'Chọn một sự kiện để tiếp tục',
        onPressed: hasSelection ? _navigateToNext : null,
        icon: Icons.arrow_forward_rounded,
        fullWidth: true,
      ),
    );
  }

  // ── Build ──────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final concertProvider = context.watch<ConcertProvider>();
    final selected = concertProvider.selectedConcert;

    return GateScaffold(
      title: 'Chọn sự kiện',
      actions: [
        Tooltip(
          message: 'Đăng xuất',
          child: IconButton(
            key: const Key('logout_button'),
            icon: const Icon(Icons.logout_rounded),
            onPressed: () => context.read<AuthProvider>().logout(),
          ),
        ),
      ],
      bottomBar: _buildBottomCta(selected),
      body: _buildBody(concertProvider),
    );
  }
}
