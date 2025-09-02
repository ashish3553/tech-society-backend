const router  = require('express').Router();
const multer  = require('multer');
const cloud   = require('../utils/cloudinary');

const upload = multer({ storage: multer.memoryStorage() });

// POST /api/upload/image
router.post(
  '/image',
  upload.single('file'),
  async (req, res, next) => {
    try {
      const result = await cloud.uploader.upload_stream(
        { folder: 'questions' },
        (err, r) => {
          if (err) return next(err);
          res.json({ success:true, url:r.secure_url });
        }
      ).end(req.file.buffer);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
