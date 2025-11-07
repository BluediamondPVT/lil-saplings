const { body, param, query } = require('express-validator');

// Post validators
const postValidators = {
  create: [
    body('heading')
      .trim()
      .notEmpty().withMessage('Heading is required')
      .isLength({ min: 3, max: 200 }).withMessage('Heading must be between 3 and 200 characters'),
    
    body('description')
      .trim()
      .notEmpty().withMessage('Description is required')
      .isLength({ min: 10 }).withMessage('Description must be at least 10 characters')
  ],

  update: [
    param('id').isMongoId().withMessage('Invalid post ID'),
    
    body('heading')
      .optional()
      .trim()
      .isLength({ min: 3, max: 200 }).withMessage('Heading must be between 3 and 200 characters'),
    
    body('description')
      .optional()
      .trim()
      .isLength({ min: 10 }).withMessage('Description must be at least 10 characters')
  ],

  getById: [
    param('id').isMongoId().withMessage('Invalid post ID')
  ],

  delete: [
    param('id').isMongoId().withMessage('Invalid post ID')
  ],

  list: [
    query('page')
      .optional()
      .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    
    query('search')
      .optional()
      .trim()
      .isLength({ max: 100 }).withMessage('Search query too long')
  ]
};

// Auth validators (keep same as before)
const authValidators = {
  register: [
    body('name')
      .trim()
      .notEmpty().withMessage('Name is required')
      .isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
    
    body('email')
      .trim()
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Invalid email format')
      .normalizeEmail(),
    
    body('password')
      .notEmpty().withMessage('Password is required')
      .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain uppercase, lowercase, and number'),
    
    body('role')
      .optional()
      .isIn(['admin', 'author']).withMessage('Invalid role')
  ],

  login: [
    body('email')
      .trim()
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Invalid email format')
      .normalizeEmail(),
    
    body('password')
      .notEmpty().withMessage('Password is required')
  ]
};

module.exports = { postValidators, authValidators };
