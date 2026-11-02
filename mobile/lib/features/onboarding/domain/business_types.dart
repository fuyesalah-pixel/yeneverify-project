// Business types accepted by POST /onboarding/merchant.
// Backend stores this as a free-form string; these are the MVP options.
import 'package:flutter/material.dart';

enum BusinessType {
  cafe('CAFE', Icons.local_cafe_outlined),
  restaurant('RESTAURANT', Icons.restaurant_outlined),
  retail('RETAIL', Icons.storefront_outlined),
  services('SERVICES', Icons.handyman_outlined),
  other('OTHER', Icons.more_horiz);

  const BusinessType(this.wireValue, this.icon);

  /// Value sent to the backend.
  final String wireValue;

  final IconData icon;
}

/// Validation result for the business name field. Kept UI-free so the
/// provider can validate without a BuildContext; the screen maps it to l10n.
enum BusinessNameError { required, tooShort, tooLong }

const int businessNameMinLength = 2;
const int businessNameMaxLength = 80;

/// Returns the validation error, or null when [value] (already trimmed by the
/// caller) is acceptable.
BusinessNameError? validateBusinessName(String value) {
  final name = value.trim();
  if (name.isEmpty) return BusinessNameError.required;
  if (name.length < businessNameMinLength) return BusinessNameError.tooShort;
  if (name.length > businessNameMaxLength) return BusinessNameError.tooLong;
  return null;
}
