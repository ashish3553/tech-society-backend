// routes/admin.js
const express    = require('express'),
      { authorize } = require('../middleware/authorize'),
      ctrl       = require('../controllers/admin'),
      router     = express.Router();

router.use(auth, authorize('mentor','admin'));
router.get('/stats', ctrl.getStats);

module.exports = router;
