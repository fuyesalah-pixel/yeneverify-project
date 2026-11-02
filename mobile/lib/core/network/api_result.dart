/// # ApiResult
///
/// Every repository call resolves to exactly one of these — callers match on
/// the sealed class, so they cannot forget the failure branch.
/// ```dart
/// final result = await repo.login(phone);
/// switch (result) {
///   case Success(:final data):   ...
///   case Failure(:final error):  ...
/// }
/// ```
library;

import 'api_error.dart';

sealed class ApiResult<T> {
  const ApiResult();

  bool get isSuccess => this is Success<T>;
  T? get dataOrNull => switch (this) {
        Success<T>(:final data) => data,
        _ => null,
      };
  ApiError? get errorOrNull => switch (this) {
        Failure<T>(:final error) => error,
        _ => null,
      };
}

class Success<T> extends ApiResult<T> {
  const Success(this.data);
  final T data;
}

class Failure<T> extends ApiResult<T> {
  const Failure(this.error);
  final ApiError error;
}
