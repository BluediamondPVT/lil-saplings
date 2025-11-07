const express = require('express');
const router = express.Router();
const path = require('path');
const Post = require('../models/Post');
const { auth } = require('../middleware/auth');
const { storage, deleteImage } = require('../config/cloudinary');
const { uploadLimiter } = require('../middleware/rateLimiter');
const { postValidators } = require('../middleware/validators');
const validate = require('../middleware/validate');
const multer = require('multer');

// Multer configuration
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files (jpg, jpeg, png, gif, webp) are allowed!'));
    }
  }
});

/**
 * @openapi
 * /api/posts:
 *   get:
 *     summary: Get all posts with pagination and search
 *     tags: [Posts]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Posts per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in heading and description
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           default: -createdAt
 *         description: Sort order (createdAt, -createdAt)
 *     responses:
 *       200:
 *         description: Posts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 posts:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       heading:
 *                         type: string
 *                       description:
 *                         type: string
 *                       image:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                       updatedAt:
 *                         type: string
 *                 pagination:
 *                   type: object
 */
router.get('/', postValidators.list, validate, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      sort = '-createdAt'
    } = req.query;

    let filter = {};

    // Search in heading and description
    if (search) {
      filter.$or = [
        { heading: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const posts = await Post.find(filter)
      .sort(sort)
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .lean();

    const totalPosts = await Post.countDocuments(filter);

    res.json({
      success: true,
      posts,
      pagination: {
        totalPages: Math.ceil(totalPosts / Number(limit)),
        currentPage: Number(page),
        totalPosts,
        limit: Number(limit),
        hasMore: Number(page) * Number(limit) < totalPosts
      }
    });
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});

/**
 * @openapi
 * /api/posts/{id}:
 *   get:
 *     summary: Get post by ID
 *     tags: [Posts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Post ID
 *     responses:
 *       200:
 *         description: Post retrieved successfully
 *       404:
 *         description: Post not found
 */
router.get('/:id', postValidators.getById, validate, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ 
        success: false,
        message: 'Post not found' 
      });
    }

    res.json({ 
      success: true, 
      post 
    });
  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});

/**
 * @openapi
 * /api/posts:
 *   post:
 *     summary: Create a new post
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - heading
 *               - description
 *             properties:
 *               heading:
 *                 type: string
 *                 description: Post heading (3-200 characters)
 *               description:
 *                 type: string
 *                 description: Post description (min 10 characters)
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Post image (max 5MB)
 *     responses:
 *       201:
 *         description: Post created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post('/', 
  auth, 
  uploadLimiter,
  upload.single('image'), 
  postValidators.create, 
  validate, 
  async (req, res) => {
    try {
      const { heading, description } = req.body;

      const postData = {
        heading,
        description
      };

      // Add Cloudinary URL if image uploaded
      if (req.file) {
        postData.image = req.file.path;
      }

      const post = new Post(postData);
      await post.save();

      res.status(201).json({
        success: true,
        message: 'Post created successfully',
        post
      });
    } catch (error) {
      console.error('Create post error:', error);
      res.status(400).json({
        success: false,
        message: 'Error creating post',
        error: error.message
      });
    }
  }
);

/**
 * @openapi
 * /api/posts/{id}:
 *   put:
 *     summary: Update post by ID
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Post ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               heading:
 *                 type: string
 *                 description: Post heading (3-200 characters)
 *               description:
 *                 type: string
 *                 description: Post description (min 10 characters)
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Post image (max 5MB)
 *     responses:
 *       200:
 *         description: Post updated successfully
 *       404:
 *         description: Post not found
 */
router.put('/:id', 
  auth, 
  uploadLimiter,
  upload.single('image'), 
  postValidators.update, 
  validate, 
  async (req, res) => {
    try {
      const { heading, description } = req.body;

      // Find existing post
      const existingPost = await Post.findById(req.params.id);
      if (!existingPost) {
        return res.status(404).json({ 
          success: false,
          message: 'Post not found' 
        });
      }

      const updateData = {};

      if (heading) updateData.heading = heading;
      if (description) updateData.description = description;

      // Handle new image upload
      if (req.file) {
        // Delete old image from Cloudinary
        if (existingPost.image) {
          await deleteImage(existingPost.image);
        }
        updateData.image = req.file.path;
      }

      const post = await Post.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      );

      res.json({
        success: true,
        message: 'Post updated successfully',
        post
      });
    } catch (error) {
      console.error('Update post error:', error);
      res.status(400).json({ 
        success: false,
        message: error.message 
      });
    }
  }
);

/**
 * @openapi
 * /api/posts/{id}:
 *   delete:
 *     summary: Delete post by ID
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Post ID
 *     responses:
 *       200:
 *         description: Post deleted successfully
 *       404:
 *         description: Post not found
 */
router.delete('/:id', auth, postValidators.delete, validate, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ 
        success: false,
        message: 'Post not found' 
      });
    }

    // Delete image from Cloudinary
    if (post.image) {
      await deleteImage(post.image);
    }

    await Post.findByIdAndDelete(req.params.id);

    res.json({ 
      success: true,
      message: 'Post deleted successfully' 
    });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});

module.exports = router;
