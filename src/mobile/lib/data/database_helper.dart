import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';

class DatabaseHelper {
  static final DatabaseHelper instance = DatabaseHelper._init();
  static Database? _database;

  DatabaseHelper._init();

  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDB('ticketbox.db');
    return _database!;
  }

  Future<Database> _initDB(String filePath) async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, filePath);

    return await openDatabase(
      path,
      version: 1,
      onCreate: _createDB,
    );
  }

  Future _createDB(Database db, int version) async {
    const idType = 'TEXT PRIMARY KEY';
    const textType = 'TEXT NOT NULL';
    const textNullableType = 'TEXT';

    await db.execute('''
CREATE TABLE checkin_entries (
  id $idType,
  concert_id $textType,
  entry_type $textType,
  qr_code_hash $textType,
  checkin_status $textType,
  zone_id $textNullableType,
  checked_in_at $textNullableType,
  updated_at $textType,
  UNIQUE(concert_id, qr_code_hash)
)
''');

    await db.execute('''
CREATE TABLE offline_checkin_logs (
  id $idType,
  concert_id $textType,
  qr_code_hash $textType,
  device_id $textType,
  scan_time $textType,
  upload_status $textType,
  server_ack_at $textNullableType
)
''');
  }

  Future<void> close() async {
    final db = await instance.database;
    db.close();
  }
}
