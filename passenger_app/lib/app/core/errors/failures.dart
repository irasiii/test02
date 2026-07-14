/// Common failure representation for the GenY app.
///
/// Mirrors the backend's uniform error shape:
/// `{ success: false, statusCode: 4xx, message: string | string[], path, timestamp }`
class AppFailure {
  final String message;
  final int? statusCode;
  final String? path;

  const AppFailure(this.message, {this.statusCode, this.path});

  factory AppFailure.network() => const AppFailure('No internet connection. Check your network and try again.');

  factory AppFailure.serverError([String? msg]) =>
      AppFailure(msg ?? 'Server error. Please try again later.', statusCode: 500);

  factory AppFailure.unauthorized() =>
      const AppFailure('Session expired. Please log in again.', statusCode: 401);

  factory AppFailure.notFound([String? msg]) =>
      AppFailure(msg ?? 'Resource not found.', statusCode: 404);

  factory AppFailure.fromResponse(int statusCode, dynamic body) {
    String msg = 'Something went wrong.';
    if (body is Map) {
      final m = body['message'];
      if (m is List && m.isNotEmpty) msg = m.join(', ');
      if (m is String) msg = m;
    } else if (body is String && body.isNotEmpty) {
      msg = body;
    }
    return AppFailure(msg, statusCode: statusCode);
  }

  @override
  String toString() => message;
}

/// Wrapper for successful Outcome-style results in domain code.
sealed class Result<T> {
  const Result();
  factory Result.success(T value) = Success<T>;
  factory Result.failure(AppFailure failure) = Failure<T>;
}

class Success<T> extends Result<T> {
  final T value;
  const Success(this.value);
}

class Failure<T> extends Result<T> {
  final AppFailure failure;
  const Failure(this.failure);
}
