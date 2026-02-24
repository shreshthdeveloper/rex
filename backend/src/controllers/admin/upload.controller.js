const path = require('path');
const fs = require('fs');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');

/**
 * POST /admin/upload
 * Handles single file upload, returns the public URL.
 */
const uploadFile = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json(new ApiResponse(400, null, 'No file uploaded'));
  }

  const url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

  res.json(new ApiResponse(200, { url, filename: req.file.filename }, 'File uploaded'));
});

/**
 * POST /admin/upload/multiple
 * Handles multiple file uploads (up to 10).
 */
const uploadMultiple = asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json(new ApiResponse(400, null, 'No files uploaded'));
  }

  const files = req.files.map((f) => ({
    url: `${req.protocol}://${req.get('host')}/uploads/${f.filename}`,
    filename: f.filename,
  }));

  res.json(new ApiResponse(200, files, `${files.length} file(s) uploaded`));
});

module.exports = { uploadFile, uploadMultiple };
