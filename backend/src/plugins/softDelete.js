/**
 * Mongoose Soft Delete Plugin
 * Adds deletedAt field and overrides find/count queries to exclude soft-deleted records.
 */
module.exports = function softDeletePlugin(schema) {
  schema.add({ deletedAt: { type: Date, default: null } });

  // Pre-hooks for queries — filter out soft-deleted by default
  const queryMiddleware = function () {
    const filter = this.getFilter();
    // Only add deletedAt filter if not explicitly querying for it
    if (filter.deletedAt === undefined) {
      this.where({ deletedAt: null });
    }
  };

  schema.pre('find', queryMiddleware);
  schema.pre('findOne', queryMiddleware);
  schema.pre('findOneAndUpdate', queryMiddleware);
  schema.pre('countDocuments', queryMiddleware);

  /**
   * Soft delete instance method
   */
  schema.methods.softDelete = function () {
    this.deletedAt = new Date();
    return this.save();
  };

  /**
   * Restore instance method
   */
  schema.methods.restore = function () {
    this.deletedAt = null;
    return this.save();
  };
};
