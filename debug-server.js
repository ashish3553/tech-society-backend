// debug-server.js - Debug script to test category routes
// Run this file with: node debug-server.js

const express = require('express');
const app = express();

// Add debug middleware to log all incoming requests
app.use((req, res, next) => {
  console.log('\n=================================');
  console.log(`📥 INCOMING REQUEST`);
  console.log(`Method: ${req.method}`);
  console.log(`URL: ${req.url}`);
  console.log(`Original URL: ${req.originalUrl}`);
  console.log(`Path: ${req.path}`);
  console.log(`Base URL: ${req.baseUrl}`);
  console.log('=================================\n');
  next();
});

app.use(express.json());

// Test if the category routes file can be loaded
try {
  console.log('🔍 Testing category routes import...');
  const categoryRoutes = require('./routes/categories');
  console.log('✅ Category routes imported successfully');
  
  // Mount the routes
  console.log('🔍 Mounting category routes on /api/categories...');
  app.use('/api/categories', categoryRoutes);
  console.log('✅ Category routes mounted successfully');
  
} catch (error) {
  console.error('❌ Error importing/mounting category routes:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}

// Add a test route to verify server is working
app.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Debug server is working',
    timestamp: new Date().toISOString()
  });
});

// List all registered routes for debugging
app.get('/debug/routes', (req, res) => {
  const routes = [];
  
  app._router.stack.forEach(middleware => {
    if (middleware.route) {
      // Direct route
      routes.push({
        path: middleware.route.path,
        methods: Object.keys(middleware.route.methods)
      });
    } else if (middleware.name === 'router') {
      // Router middleware
      middleware.handle.stack.forEach(handler => {
        if (handler.route) {
          routes.push({
            path: middleware.regexp.source,
            route: handler.route.path,
            methods: Object.keys(handler.route.methods)
          });
        }
      });
    }
  });
  
  res.json({
    success: true,
    registeredRoutes: routes,
    stackLength: app._router.stack.length
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('❌ Global Error Handler:', {
    error: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method
  });
  
  res.status(500).json({
    success: false,
    message: error.message || 'Internal server error',
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });
});

// 404 handler
app.use('*', (req, res) => {
  console.warn(`❌ 404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    suggestion: 'Try /test or /debug/routes to see available routes'
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log('\n🚀 Debug server started successfully!');
  console.log(`🌐 Server running on: http://localhost:${PORT}`);
  console.log('\n📋 Test these URLs:');
  console.log(`   - http://localhost:${PORT}/test`);
  console.log(`   - http://localhost:${PORT}/debug/routes`);
  console.log(`   - http://localhost:${PORT}/api/categories`);
  console.log(`   - http://localhost:${PORT}/api/categories/tree`);
  console.log('\n🔍 Watch the console for detailed request logs...\n');
});

module.exports = app;