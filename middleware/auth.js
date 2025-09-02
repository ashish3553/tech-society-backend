// middleware/auth.js
const jwt = require('jsonwebtoken')
const User = require('../models/User')

module.exports = async function auth(req, res, next) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.replace(/^Bearer /, '')
  if (!token) return res.status(401).json({ success: false, message: 'No token' })
  try {
    const { id } = jwt.verify(token, process.env.JWT_SECRET)
    const user = await User.findById(id).select('role name email')
//     if (!user || !user.isActive) {
//   return res
//     .status(403)
//     .json({ success:false, message: 'Account is deactivated' });
// }
    if (!user) return res.status(401).json({ success: false, message: 'Invalid user' })
    req.user = { id: user._id.toString(), role: user.role }
    next()
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid token' })
  }
}
