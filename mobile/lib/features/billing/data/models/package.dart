// GET /packages catalog row. Prices are bigint minor units on the wire, so
// they arrive as strings and stay strings until the formatter parses them.
class Package {
  const Package({
    required this.code,
    required this.name,
    this.description,
    this.priceMinor,
    this.currency = 'ETB',
    this.creditsPerMonth,
    this.unlimited = false,
    this.isCustom = false,
    this.displayOrder = 0,
  });

  final String code;
  final String name;
  final String? description;

  /// bigint minor units as string; null for the custom-priced API package.
  final String? priceMinor;
  final String currency;

  /// null for unlimited plans.
  final int? creditsPerMonth;
  final bool unlimited;
  final bool isCustom;
  final int displayOrder;

  int? get priceValue => int.tryParse(priceMinor ?? '');

  /// FREE is provisioned at onboarding; API is negotiated with sales.
  bool get isPurchasable =>
      !isCustom &&
      code != 'FREE' &&
      code != 'API' &&
      priceValue != null &&
      priceValue! > 0;

  factory Package.fromJson(Map<String, dynamic> json) {
    return Package(
      code: (json['code'] as String?) ?? '',
      name: (json['name'] as String?) ?? '',
      description: json['description'] as String?,
      priceMinor: json['priceMinor']?.toString(),
      currency: (json['currency'] as String?) ?? 'ETB',
      creditsPerMonth: (json['creditsPerMonth'] as num?)?.toInt(),
      unlimited: json['unlimited'] == true,
      isCustom: json['isCustom'] == true,
      displayOrder: (json['displayOrder'] as num?)?.toInt() ?? 0,
    );
  }
}
