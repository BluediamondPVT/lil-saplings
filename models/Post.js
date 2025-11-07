const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema({
  heading: {
    type: String,
    required: [true, 'Heading is required'],
    trim: true,
    minlength: [3, 'Heading must be at least 3 characters'],
    maxlength: [200, 'Heading cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    minlength: [10, 'Description must be at least 10 characters']
  },
  image: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Index for better search performance
PostSchema.index({ heading: 'text', description: 'text' });
PostSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Post', PostSchema);
