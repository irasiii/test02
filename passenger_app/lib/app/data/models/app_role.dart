/// Mirrors backend Role enum (src/app/common/decorators/roles.decorator.ts)
enum AppRole { CUSTOMER, DRIVER, RESTAURANT, ADMIN }

extension AppRoleX on AppRole {
  String get label => switch (this) {
    AppRole.CUSTOMER => 'Customer',
    AppRole.DRIVER => 'Driver',
    AppRole.RESTAURANT => 'Restaurant',
    AppRole.ADMIN => 'Admin',
  };

  bool get isCustomer => this == AppRole.CUSTOMER;
  bool get isDriver => this == AppRole.DRIVER;
  bool get isRestaurant => this == AppRole.RESTAURANT;
  bool get isAdmin => this == AppRole.ADMIN;

  String get asString => name;

  static AppRole fromString(String value) {
    return AppRole.values.firstWhere(
      (r) => r.name == value.toUpperCase(),
      orElse: () => AppRole.CUSTOMER,
    );
  }
}
