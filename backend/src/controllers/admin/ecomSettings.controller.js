const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');

/**
 * GET /admin/ecom-settings
 */
const getSettings = asyncHandler(async (req, res) => {
  let settings = await req.models.EcomSettings.findOne();
  if (!settings) {
    settings = await req.models.EcomSettings.create({});
  }
  // Ensure wallBanners is always present
  settings.wallBanners = settings.wallBanners || [];
  res.json(new ApiResponse(200, settings));
});

/**
 * PUT /admin/ecom-settings
 */
const updateSettings = asyncHandler(async (req, res) => {
  let settings = await req.models.EcomSettings.findOne();
  if (!settings) {
    settings = new req.models.EcomSettings();
  }

  const allowed = [
    'storeName', 'tagline', 'logo', 'favicon',
    'primaryColor', 'secondaryColor', 'accentColor', 'theme',
    'banners', 'wallBanners', 'marqueeText', 'marqueeEnabled',
    'saleAlertText', 'saleAlertEnabled',
    'productsPerRow', 'productsPerPage', 'showFeatured', 'showCategories',
    'sections', 'termsAndConditions', 'requireTermsOnSignup', 'requiredDocuments',
    'termsContent', 'returnRefundContent', 'privacyContent', 'contactContent', 'aboutUsContent',
    'footerText', 'socialLinks',
    'modals',
    'ageVerificationEnabled', 'ageVerificationTitle', 'ageVerificationMessage',
    'ageVerificationMinAge', 'ageVerificationLockMessage',
  ];

  allowed.forEach((k) => {
    if (req.body[k] !== undefined) settings[k] = req.body[k];
  });

  await settings.save();
  res.json(new ApiResponse(200, settings, 'Settings updated'));
});

module.exports = { getSettings, updateSettings };
