const { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } = require('../config/constants');

/**
 * Parse page/limit from query and return normalized values + meta.
 */
function paginate(query, totalCount) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(
    MAX_PAGE_LIMIT,
    Math.max(1, parseInt(query.limit, 10) || DEFAULT_PAGE_LIMIT)
  );
  const offset = (page - 1) * limit;
  const totalPages = Math.ceil(totalCount / limit);

  return {
    page,
    limit,
    offset,
    meta: { page, limit, total: totalCount, totalPages },
  };
}

/**
 * Apply in-memory pagination to an array.
 */
function applyPagination(arr, offset, limit) {
  return arr.slice(offset, offset + limit);
}

module.exports = { paginate, applyPagination };
