const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const { paginate, paginationMeta } = require('../../utils/helpers');

/**
 * List transaction log entries with flexible filters.
 * Query params: page, limit, partyType, partyId, eventType, sourceType,
 *               startDate, endDate, direction
 */
const list = asyncHandler(async (req, res) => {
  const { page, limit, partyType, partyId, eventType, sourceType, startDate, endDate, direction } = req.query;
  const { skip, limit: lim, page: pg } = paginate(page, limit);
  const filter = {};

  if (partyType) filter.partyType = partyType;
  if (partyId) filter.partyId = partyId;
  if (eventType) filter.eventType = eventType;
  if (sourceType) filter.sourceType = sourceType;
  if (direction) filter.direction = direction;
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
  }

  const [entries, total] = await Promise.all([
    req.models.TransactionLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip).limit(lim)
      .populate('createdBy', 'name'),
    req.models.TransactionLog.countDocuments(filter),
  ]);

  res.json(new ApiResponse(200, { entries, pagination: paginationMeta(total, pg, lim) }));
});

/**
 * Summary: totals grouped by eventType for a date range.
 */
const summary = asyncHandler(async (req, res) => {
  const { startDate, endDate, partyType } = req.query;
  const match = {};
  if (partyType) match.partyType = partyType;
  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) match.createdAt.$gte = new Date(startDate);
    if (endDate) match.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
  }

  const result = await req.models.TransactionLog.aggregate([
    { $match: match },
    {
      $group: {
        _id: { eventType: '$eventType', direction: '$direction' },
        total: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
    { $sort: { '_id.eventType': 1 } },
  ]);

  // Also compute cash-in vs cash-out totals
  const totalIn = result.filter(r => r._id.direction === 'in').reduce((s, r) => s + r.total, 0);
  const totalOut = result.filter(r => r._id.direction === 'out').reduce((s, r) => s + r.total, 0);

  res.json(new ApiResponse(200, {
    breakdown: result.map(r => ({
      eventType: r._id.eventType,
      direction: r._id.direction,
      total: Math.round(r.total * 100) / 100,
      count: r.count,
    })),
    totalIn: Math.round(totalIn * 100) / 100,
    totalOut: Math.round(totalOut * 100) / 100,
    netFlow: Math.round((totalIn - totalOut) * 100) / 100,
  }));
});

module.exports = { list, summary };
