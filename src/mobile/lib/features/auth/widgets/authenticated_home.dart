import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../checkin/screens/scanner_screen.dart';
import '../../checkin/services/checkin_service.dart';
import '../../concerts/models/concert.dart';
import '../../concerts/screens/event_list_screen.dart';
import '../providers/auth_provider.dart';

class AuthenticatedHome extends StatefulWidget {
  const AuthenticatedHome({super.key});

  @override
  State<AuthenticatedHome> createState() => _AuthenticatedHomeState();
}

class _AuthenticatedHomeState extends State<AuthenticatedHome> {
  Future<Concert?>? _preparedConcertFuture;
  String? _resolvedUserId;
  bool _resolvedOfflineDegraded = false;

  @override
  Widget build(BuildContext context) {
    final authProvider = context.watch<AuthProvider>();

    if (!authProvider.isOfflineDegraded || authProvider.user == null) {
      return const EventListScreen();
    }

    _ensurePreparedConcertFuture(authProvider);

    return FutureBuilder<Concert?>(
      future: _preparedConcertFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }

        final preparedConcert = snapshot.data;
        if (preparedConcert != null) {
          return ScannerScreen(concert: preparedConcert);
        }

        return const EventListScreen();
      },
    );
  }

  void _ensurePreparedConcertFuture(AuthProvider authProvider) {
    final userId = authProvider.user?.id;
    final shouldRefreshFuture = _preparedConcertFuture == null ||
        _resolvedUserId != userId ||
        _resolvedOfflineDegraded != authProvider.isOfflineDegraded;

    if (!shouldRefreshFuture) return;

    _resolvedUserId = userId;
    _resolvedOfflineDegraded = authProvider.isOfflineDegraded;
    _preparedConcertFuture = _loadPreparedConcert(userId);
  }

  Future<Concert?> _loadPreparedConcert(String? userId) async {
    if (userId == null || userId.isEmpty) return null;

    final checkinService = context.read<CheckinService>();
    final snapshot =
        await checkinService.getPreparedConcertSnapshot(userId: userId);

    if (snapshot == null) {
      return null;
    }

    final concert = Concert.fromJson(snapshot);
    if (concert.id.isEmpty) {
      await checkinService.clearPreparedConcertSnapshot();
      return null;
    }

    final hasOfflineEntries = await checkinService.hasOfflineEntries(concert.id);
    if (!hasOfflineEntries) {
      await checkinService.clearPreparedConcertSnapshot();
      return null;
    }

    return concert;
  }
}
