const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');
const { paginate, paginationMeta } = require('../../utils/helpers');

const list = asyncHandler(async (req, res) => {
  const { page, limit, status, search } = req.query;
  const { skip, limit: lim, page: pg } = paginate(page, limit);

  const filter = {};
  if (status) filter.status = status;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
      { subject: { $regex: search, $options: 'i' } },
      { message: { $regex: search, $options: 'i' } },
    ];
  }

  const [queries, total] = await Promise.all([
    req.models.ContactQuery.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(lim)
      .lean(),
    req.models.ContactQuery.countDocuments(filter),
  ]);

  res.json(new ApiResponse(200, { queries, pagination: paginationMeta(total, pg, lim) }));
});

const updateStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['new', 'in_progress', 'resolved'].includes(status)) {
    throw new ApiError(400, 'Invalid status');
  }

  const query = await req.models.ContactQuery.findById(req.params.id);
  if (!query) throw new ApiError(404, 'Query not found');

  query.status = status;
  query.resolvedAt = status === 'resolved' ? new Date() : undefined;
  await query.save();

  res.json(new ApiResponse(200, query, 'Query status updated'));
});

module.exports = { list, updateStatus };
