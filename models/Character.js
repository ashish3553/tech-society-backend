const mongoose = require('mongoose');

const CharacterSchema = new mongoose.Schema({
  name: { type: String, required: true },
  image: String, // Cloudinary URL for character image/gif
  description: String,
  personality: String, // Brief character description
  defaultSide: { type: String, enum: ['left', 'right'], default: 'left' },
  
  // Styling options
  messageStyle: {
    backgroundColor: { type: String, default: '#e3f2fd' },
    textColor: { type: String, default: '#000000' },
    borderRadius: { type: String, default: '16px' }
  },
  
  // Usage tracking
  usedInArticles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Article' }],
  
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, {
  timestamps: true
});

module.exports = mongoose.model('Character', CharacterSchema);