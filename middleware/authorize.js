// middleware/authorize.js
module.exports = function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
   console.log("Role now", req.user.role)
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ success: false, message: 'Forbidden: insufficient rights' });
    }
    next();
  };
};
