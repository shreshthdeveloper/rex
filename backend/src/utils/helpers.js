const slugify = require('slugify');

/**
 * Generate slug from string
 */
const generateSlug = (str) => {
  return slugify(str, { lower: true, strict: true });
};

/**
 * Build pagination response
 */
const paginate = (page = 1, limit = 20) => {
  const p = Math.max(1, parseInt(page));
  const l = Math.min(100, Math.max(1, parseInt(limit)));
  return { skip: (p - 1) * l, limit: l, page: p };
};

/**
 * Build pagination meta
 */
const paginationMeta = (total, page, limit) => ({
  total,
  page,
  limit,
  pages: Math.ceil(total / limit),
});

module.exports = { generateSlug, paginate, paginationMeta };
