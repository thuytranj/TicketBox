import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../config/api_config.dart';
import 'api_exception.dart';

class DioClient {
  late final Dio _dio;
  final FlutterSecureStorage _storage;

  DioClient(this._storage) {
    _dio = Dio(BaseOptions(
      baseUrl: ApiConfig.baseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 10),
      responseType: ResponseType.json,
    ));

    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await _storage.read(key: 'accessToken');
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        return handler.next(options);
      },
      onResponse: (response, handler) {
        return handler.next(response);
      },
      onError: (DioException e, handler) async {
        if (e.response?.statusCode == 401 &&
            e.requestOptions.path != '/auth/login' &&
            e.requestOptions.path != '/auth/refresh') {
          final refreshToken = await _storage.read(key: 'refreshToken');
          if (refreshToken != null) {
            try {
              final refreshDio = Dio(BaseOptions(
                baseUrl: ApiConfig.baseUrl,
                responseType: ResponseType.json,
              ));
              final response = await refreshDio.post('/auth/refresh', data: {
                'refreshToken': refreshToken,
              });
              
              final data = response.data;
              if (data is Map<String, dynamic> && data['success'] == true) {
                final newAccessToken = data['data']?['accessToken'];
                final newRefreshToken = data['data']?['refreshToken'];
                
                if (newAccessToken != null) {
                  await _storage.write(key: 'accessToken', value: newAccessToken);
                }
                if (newRefreshToken != null) {
                  await _storage.write(key: 'refreshToken', value: newRefreshToken);
                }
                
                final opts = e.requestOptions;
                opts.headers['Authorization'] = 'Bearer $newAccessToken';
                
                final cloneReq = await _dio.request(
                  opts.path,
                  options: Options(
                    method: opts.method,
                    headers: opts.headers,
                  ),
                  data: opts.data,
                  queryParameters: opts.queryParameters,
                );
                return handler.resolve(cloneReq);
              }
            } catch (_) {
              await _storage.delete(key: 'accessToken');
              await _storage.delete(key: 'refreshToken');
            }
          }
        }
        return handler.next(e);
      },
    ));
  }

  Dio get dio => _dio;

  Future<dynamic> post(String path, {dynamic data}) async {
    try {
      final response = await _dio.post(path, data: data);
      return _processResponse(response);
    } on DioException catch (e) {
      throw _processError(e);
    }
  }

  Future<dynamic> get(String path, {Map<String, dynamic>? queryParameters}) async {
    try {
      final response = await _dio.get(path, queryParameters: queryParameters);
      return _processResponse(response);
    } on DioException catch (e) {
      throw _processError(e);
    }
  }

  dynamic _processResponse(Response response) {
    final data = response.data;
    if (data is Map<String, dynamic>) {
      if (data['success'] == true) {
        return data['data'];
      } else {
        throw ApiException(
          _readMessage(data['message'], fallback: 'Unknown error'),
          data['statusCode'] ?? response.statusCode ?? 400,
          responseData: data,
        );
      }
    }
    return data;
  }

  ApiException _processError(DioException e) {
    final isNetworkError =
        e.type == DioExceptionType.connectionError ||
        e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.receiveTimeout ||
        e.type == DioExceptionType.sendTimeout ||
        e.response == null;

    if (e.response?.data is Map<String, dynamic>) {
      final data = e.response!.data;
      return ApiException(
        _readMessage(data['message'], fallback: e.message ?? 'Unknown error'),
        e.response?.statusCode ?? 500,
        isNetworkError: isNetworkError,
        responseData: data,
      );
    }
    return ApiException(
      e.message ?? 'Unknown error',
      e.response?.statusCode ?? 500,
      isNetworkError: isNetworkError,
    );
  }

  String _readMessage(dynamic rawMessage, {required String fallback}) {
    if (rawMessage is String && rawMessage.isNotEmpty) {
      return rawMessage;
    }
    if (rawMessage is List) {
      final messages = rawMessage
          .whereType<Object>()
          .map((message) => message.toString())
          .where((message) => message.isNotEmpty)
          .toList();
      if (messages.isNotEmpty) {
        return messages.join(', ');
      }
    }
    return fallback;
  }
}
