const ApiError = require('../utils/ApiError');

/**
 * Role-based access control middleware
 * @param  {...string} roles - Allowed roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (req.isSuperAdmin) return next(); // superadmin can access anything
    if (!req.user) return next(new ApiError(401, 'Authentication required'));
    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, `Access denied. Required roles: ${roles.join(', ')}`));
    }
    next();
  };
};

// Shorthand helpers
const adminOnly = authorize('admin');
const managerPlus = authorize('admin', 'manager');
const cashierPlus = authorize('admin', 'manager', 'cashier');
const warehousePlus = authorize('admin', 'manager', 'warehouse_staff');
const accountantPlus = authorize('admin', 'manager', 'accountant');
const allRoles = authorize('admin', 'manager', 'cashier', 'warehouse_staff', 'accountant');

module.exports = { authorize, adminOnly, managerPlus, cashierPlus, warehousePlus, accountantPlus, allRoles };
