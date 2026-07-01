import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'core/network/dio_client.dart';
import 'core/theme/gate_app_theme.dart';
import 'features/auth/services/auth_service.dart';
import 'features/auth/providers/auth_provider.dart';
import 'features/auth/screens/login_screen.dart';
import 'features/auth/widgets/authenticated_home.dart';
import 'features/concerts/services/concert_service.dart';
import 'features/concerts/providers/concert_provider.dart';
import 'features/checkin/services/checkin_service.dart';
import 'features/checkin/providers/checkin_provider.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  // Lock to portrait — gate staff hold phone upright while scanning.
  SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);
  
  const storage = FlutterSecureStorage();
  final dioClient = DioClient(storage);
  
  final authService = AuthService(dioClient, storage);
  final concertService = ConcertService(dioClient);
  final checkinService = CheckinService(dioClient, storage);

  runApp(
    MultiProvider(
      providers: [
        Provider<CheckinService>(
          create: (_) => checkinService,
          dispose: (_, service) => service.dispose(),
        ),
        ChangeNotifierProvider(create: (_) => AuthProvider(authService)..checkAuthStatus()),
        ChangeNotifierProvider(create: (_) => ConcertProvider(concertService)),
        ChangeNotifierProvider(create: (_) => CheckinProvider(checkinService)),
      ],
      child: const TicketBoxApp(),
    ),
  );
}

class TicketBoxApp extends StatelessWidget {
  const TicketBoxApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'TicketBox Gate App',
      theme: GateAppTheme.dark(),
      themeMode: ThemeMode.dark,
      home: Consumer<AuthProvider>(
        builder: (context, authProvider, _) {
          if (authProvider.state == AuthState.initial || (authProvider.state == AuthState.loading && authProvider.user == null)) {
            return const Scaffold(body: Center(child: CircularProgressIndicator()));
          }
          if (authProvider.state == AuthState.authenticated) {
            return const AuthenticatedHome();
          }
          return const LoginScreen();
        },
      ),
    );
  }
}
