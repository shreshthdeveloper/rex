const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const ApiResponse = require('../../utils/ApiResponse');
const { paginate, paginationMeta } = require('../../utils/helpers');

const list = asyncHandler(async (req, res) => {
  const { page, limit, read } = req.query;
  const { skip, limit: lim, page: pg } = paginate(page, limit);
  const filter = { user: req.user._id };
  if (read === 'true') filter.isRead = true;
  if (read === 'false') filter.isRead = false;
  const [notifications, total] = await Promise.all([
    req.models.Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(lim),
    req.models.Notification.countDocuments(filter),
  ]);
  const unreadCount = await req.models.Notification.countDocuments({ user: req.user._id, isRead: false });
  res.json(new ApiResponse(200, { notifications, unreadCount, pagination: paginationMeta(total, pg, lim) }));
});

const markRead = asyncHandler(async (req, res) => {
  const n = await req.models.Notification.findOne({ _id: req.params.id, user: req.user._id });
  if (!n) throw new ApiError(404, 'Notification not found');
  n.isRead = true;
  n.readAt = new Date();
  await n.save();
  res.json(new ApiResponse(200, n));
});

const markAllRead = asyncHandler(async (req, res) => {
  await req.models.Notification.updateMany(
    { user: req.user._id, isRead: false },
    { isRead: true, readAt: new Date() },
  );
  res.json(new ApiResponse(200, null, 'All notifications marked as read'));
});

const remove = asyncHandler(async (req, res) => {
  const n = await req.models.Notification.findOne({ _id: req.params.id, user: req.user._id });
  if (!n) throw new ApiError(404, 'Notification not found');
  await n.deleteOne();
  res.json(new ApiResponse(200, null, 'Notification deleted'));
});

module.exports = { list, markRead, markAllRead, remove };
