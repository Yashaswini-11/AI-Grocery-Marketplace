const asyncHandler = require('../utils/asyncHandler');
const { getReorderSuggestions } = require('../services/reorderService');

const getSuggestions = asyncHandler(async (req, res) => {
  // Always the logged-in user's own history
  const result = await getReorderSuggestions(req.user._id);
  res.json({ success: true, ...result });
});

module.exports = { getSuggestions };