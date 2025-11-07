// api/index.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');
require('dotenv').config();

// Swagger
const swaggerUi = require('swagger-ui-express');
const swaggerJSDoc = require('swagger-jsdoc');

// Rate limiting
const { apiLimiter, authLimiter } = require('../middleware/rateLimiter');

const app = express();

// ===========================
// SECURITY MIDDLEWARE
// ===========================

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https://res.cloudinary.com"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200
}));

app.use(mongoSanitize());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(compression());

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// ===========================
// DATABASE CONNECTION
// ===========================

let cachedDb = null;

const connectDB = async () => {
  if (cachedDb && cachedDb.connection.readyState === 1) {
    console.log('✅ Using cached database connection');
    return cachedDb;
  }

  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4
    });

    cachedDb = conn;
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error.message);
    cachedDb = null;
    throw error;
  }
};

// ===========================
// SWAGGER CONFIGURATION
// ===========================

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Classic Blog API',
      version: '1.0.0',
      description: 'Production-ready Blog API with authentication, image uploads, and full CRUD operations',
      contact: {
        name: 'API Support',
        email: 'support@example.com'
      }
    },
    servers: [
      {
        url: process.env.NODE_ENV === 'production'
          ? `https://${process.env.VERCEL_URL}`
          : process.env.SERVER_URL || 'http://localhost:5000',
        description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT token'
        }
      }
    }
  },
  apis: ['../routes/*.js']
};

const swaggerSpec = swaggerJSDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Blog API Documentation'
}));

// ===========================
// CONNECTION MIDDLEWARE (Vercel)
// ===========================

app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    res.status(503).json({ 
      message: 'Database connection failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ===========================
// ROUTES
// ===========================

app.use('/api/posts', apiLimiter, require('../routes/posts'));
app.use('/api/auth', authLimiter, require('../routes/auth'));

// Health check
app.get('/', (req, res) => {
  res.json({
    message: 'Classic Blog API is running!',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    docs: '/api-docs'
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// ===========================
// ERROR HANDLER
// ===========================

app.use((error, req, res, next) => {
  console.error('Error:', error);

  if (error.name === 'ValidationError') {
    return res.status(400).json({
      message: 'Validation Error',
      errors: Object.values(error.errors).map(err => err.message)
    });
  }

  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({ message: 'Invalid token' });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({ message: 'Token expired' });
  }

  if (error.code === 11000) {
    return res.status(400).json({ message: 'Duplicate field value entered' });
  }

  res.status(error.status || 500).json({
    message: error.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

// ===========================
// EXPORT FOR VERCEL
// ===========================

module.exports = app;
