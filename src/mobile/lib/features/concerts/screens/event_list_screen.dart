import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/gate_colors.dart';
import '../../../core/theme/gate_radii.dart';
import '../../../core/theme/gate_spacing.dart';
import '../../../core/theme/gate_typography.dart';
import '../../../shared/widgets/gate_empty_state.dart';
import '../../../shared/widgets/gate_error_state.dart';
import '../../../shared/widgets/gate_loading_state.dart';
import '../../../shared/widgets/gate_scaffold.dart';
import '../../auth/providers/auth_provider.dart';
import '../models/concert.dart';
import '../providers/concert_provider.dart';
import '../widgets/event_card.dart';
import '../../checkin/screens/preload_screen.dart';

// ── Tab index constants ────────────────────────────────────────────────────────

const int _tabToday = 0;
const int _tabUpcoming = 1;
const int _tabPast = 2;

const int _pageSize = 6;

// ── Screen ─────────────────────────────────────────────────────────────────────

class EventListScreen extends StatefulWidget {
  const EventListScreen({super.key});

  @override
  State<EventListScreen> createState() => _EventListScreenState();
}

class _EventListScreenState extends State<EventListScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  final TextEditingController _searchController = TextEditingController();

  String _searchQuery = '';
  int _currentPage = 1;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(
      length: 3,
      vsync: this,
      initialIndex: _tabToday,
    );
    _tabController.addListener(_onTabChanged);
    _searchController.addListener(_onSearchChanged);

    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<ConcertProvider>().fetchConcerts();
    });
  }

  @override
  void dispose() {
    _tabController.removeListener(_onTabChanged);
    _tabController.dispose();
    _searchController.removeListener(_onSearchChanged);
    _searchController.dispose();
    super.dispose();
  }

  void _onTabChanged() {
    if (!_tabController.indexIsChanging) return;
    setState(() => _currentPage = 1);
  }

  void _onSearchChanged() {
    final q = _searchController.text.trim().toLowerCase();
    if (q != _searchQuery) {
      setState(() {
        _searchQuery = q;
        _currentPage = 1;
      });
    }
  }

  // ── Navigation ──────────────────────────────────────────────────────────────

  void _navigateTo(Concert concert) {
    if (!concert.isGateOpen) {
      final messenger = ScaffoldMessenger.maybeOf(context);
      messenger
        ?..hideCurrentSnackBar()
        ..showSnackBar(
          SnackBar(
            content: Text(concert.gateBlockedMessage),
            backgroundColor: GateColors.scanUsed.primary,
          ),
        );
      return;
    }

    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => PreloadScreen(concert: concert),
    ));
  }

  // ── Error helpers ───────────────────────────────────────────────────────────

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

  // ── Tab filtering ───────────────────────────────────────────────────────────

  List<Concert> _filterByTab(List<Concert> all, int tabIndex) {
    final now = DateTime.now();
    switch (tabIndex) {
      case _tabToday:
        return all.where((c) {
          final start = c.startTime?.toLocal();
          if (start == null) return false;
          return _isSameLocalDay(start, now);
        }).toList();

      case _tabUpcoming:
        // Concerts after today. null startTime → placed at end.
        final withTime = all.where((c) {
          final start = c.startTime?.toLocal();
          if (start == null) return false;
          // Strictly after today (not same day)
          return start.isAfter(DateTime(now.year, now.month, now.day + 1)
              .subtract(const Duration(microseconds: 1)));
        }).toList();
        final noTime =
            all.where((c) => c.startTime == null).toList();
        return [...withTime, ...noTime];

      case _tabPast:
        return all.where((c) {
          final status = c.status?.toLowerCase();
          if (status == 'completed') return true;
          final end = c.endTime?.toLocal();
          return end != null && end.isBefore(now);
        }).toList();

      default:
        return all;
    }
  }

  bool _isSameLocalDay(DateTime a, DateTime b) =>
      a.year == b.year && a.month == b.month && a.day == b.day;

  List<Concert> _filterBySearch(List<Concert> concerts, String query) {
    if (query.isEmpty) return concerts;
    return concerts.where((c) {
      return c.title.toLowerCase().contains(query) ||
          c.location.toLowerCase().contains(query);
    }).toList();
  }

  // ── Build ───────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final concertProvider = context.watch<ConcertProvider>();

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
      body: Column(
        children: [
          _buildSearchBar(),
          _buildTabBar(),
          Expanded(child: _buildBody(concertProvider)),
        ],
      ),
    );
  }

  // ── Search bar ──────────────────────────────────────────────────────────────

  Widget _buildSearchBar() {
    return Padding(
      padding: EdgeInsets.fromLTRB(
        GateSpacing.md,
        GateSpacing.sm,
        GateSpacing.md,
        GateSpacing.xs,
      ),
      child: TextField(
        key: const Key('search_field'),
        controller: _searchController,
        style: GateTypography.bodyMedium.copyWith(color: GateColors.onSurface),
        decoration: InputDecoration(
          hintText: 'Tìm theo tên hoặc địa điểm…',
          hintStyle: GateTypography.bodyMedium,
          prefixIcon: const Icon(
            Icons.search_rounded,
            color: GateColors.onSurfaceSub,
            size: 20,
          ),
          suffixIcon: _searchQuery.isNotEmpty
              ? IconButton(
                  key: const Key('search_clear'),
                  icon: const Icon(
                    Icons.close_rounded,
                    color: GateColors.onSurfaceSub,
                    size: 18,
                  ),
                  onPressed: () => _searchController.clear(),
                  tooltip: 'Xóa tìm kiếm',
                )
              : null,
          filled: true,
          fillColor: GateColors.surface,
          contentPadding: EdgeInsets.symmetric(
            horizontal: GateSpacing.md,
            vertical: GateSpacing.sm,
          ),
          border: OutlineInputBorder(
            borderRadius: GateRadii.md,
            borderSide: const BorderSide(color: GateColors.border, width: 1),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: GateRadii.md,
            borderSide: const BorderSide(color: GateColors.border, width: 1),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: GateRadii.md,
            borderSide:
                const BorderSide(color: GateColors.primary, width: 1.5),
          ),
        ),
      ),
    );
  }

  // ── Tab bar ─────────────────────────────────────────────────────────────────

  Widget _buildTabBar() {
    return Container(
      margin: EdgeInsets.symmetric(horizontal: GateSpacing.md),
      decoration: BoxDecoration(
        color: GateColors.surface,
        borderRadius: GateRadii.md,
      ),
      child: TabBar(
        key: const Key('event_tab_bar'),
        controller: _tabController,
        labelStyle: GateTypography.label.copyWith(fontWeight: FontWeight.w600),
        unselectedLabelStyle: GateTypography.label,
        labelColor: GateColors.primary,
        unselectedLabelColor: GateColors.onSurfaceSub,
        indicatorColor: GateColors.primary,
        indicatorWeight: 2,
        dividerColor: Colors.transparent,
        tabs: const [
          Tab(key: Key('tab_today'), text: 'Hôm nay'),
          Tab(key: Key('tab_upcoming'), text: 'Sắp diễn ra'),
          Tab(key: Key('tab_past'), text: 'Đã diễn ra'),
        ],
      ),
    );
  }

  // ── Body ────────────────────────────────────────────────────────────────────

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
        return TabBarView(
          controller: _tabController,
          children: [
            _buildTabContent(provider.concerts, _tabToday),
            _buildTabContent(provider.concerts, _tabUpcoming),
            _buildTabContent(provider.concerts, _tabPast),
          ],
        );
    }
  }

  // ── Tab content ─────────────────────────────────────────────────────────────

  Widget _buildTabContent(List<Concert> all, int tabIndex) {
    final tabFiltered = _filterByTab(all, tabIndex);
    final searchFiltered = _filterBySearch(tabFiltered, _searchQuery);

    if (searchFiltered.isEmpty) {
      return RefreshIndicator(
        color: GateColors.primary,
        backgroundColor: GateColors.surface,
        onRefresh: context.read<ConcertProvider>().fetchConcerts,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: SizedBox(
            height: 400,
            child: GateEmptyState(
              icon: Icons.event_busy_outlined,
              message: _searchQuery.isNotEmpty
                  ? 'Không tìm thấy sự kiện phù hợp.'
                  : 'Không có sự kiện trong mục này.',
            ),
          ),
        ),
      );
    }

    final totalPages = (searchFiltered.length / _pageSize).ceil();
    // Clamp current page in case filter reduced total pages.
    final page = _currentPage.clamp(1, totalPages);
    final startIndex = (page - 1) * _pageSize;
    final pageItems = searchFiltered.skip(startIndex).take(_pageSize).toList();

    return Column(
      children: [
        Expanded(
          child: RefreshIndicator(
            color: GateColors.primary,
            backgroundColor: GateColors.surface,
            onRefresh: context.read<ConcertProvider>().fetchConcerts,
            child: ListView.separated(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: EdgeInsets.fromLTRB(
                GateSpacing.md,
                GateSpacing.sm,
                GateSpacing.md,
                GateSpacing.md,
              ),
              itemCount: pageItems.length,
              separatorBuilder: (_, __) => GateSpacing.vertical(GateSpacing.sm),
              itemBuilder: (context, index) {
                final concert = pageItems[index];
                return EventCard(
                  key: ValueKey(concert.id),
                  concert: concert,
                  onTap: () => _navigateTo(concert),
                );
              },
            ),
          ),
        ),
        if (totalPages > 1) _buildPaginationFooter(page, totalPages),
      ],
    );
  }

  // ── Pagination footer ───────────────────────────────────────────────────────

  Widget _buildPaginationFooter(int page, int totalPages) {
    return Container(
      key: const Key('pagination_footer'),
      padding: EdgeInsets.symmetric(
        horizontal: GateSpacing.md,
        vertical: GateSpacing.sm,
      ),
      decoration: const BoxDecoration(
        color: GateColors.surface,
        border: Border(
          top: BorderSide(color: GateColors.border, width: 1),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          IconButton(
            key: const Key('page_prev'),
            icon: const Icon(Icons.chevron_left_rounded),
            color: page > 1 ? GateColors.onSurface : GateColors.border,
            onPressed:
                page > 1 ? () => setState(() => _currentPage = page - 1) : null,
            tooltip: 'Trang trước',
          ),
          GateSpacing.horizontal(GateSpacing.xs),
          Text(
            'Trang $page / $totalPages',
            style: GateTypography.label.copyWith(color: GateColors.onSurface),
          ),
          GateSpacing.horizontal(GateSpacing.xs),
          IconButton(
            key: const Key('page_next'),
            icon: const Icon(Icons.chevron_right_rounded),
            color: page < totalPages ? GateColors.onSurface : GateColors.border,
            onPressed: page < totalPages
                ? () => setState(() => _currentPage = page + 1)
                : null,
            tooltip: 'Trang sau',
          ),
        ],
      ),
    );
  }
}
