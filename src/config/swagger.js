const swaggerJSDoc = require('swagger-jsdoc');

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Tap2Help API Documentation',
    version: '1.0.0',
    description: 'API documentation for the Tap2Help backend service',
  },
  servers: [
    {
      url: `http://localhost:${process.env.PORT || 5001}`,
      description: 'Development server',
    },
    {
      url: 'https://api.tap2help.com', // Placeholder for production URL
      description: 'Production server',
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  security: [
    {
      bearerAuth: [],
    },
  ],
};

const options = {
  swaggerDefinition,
  apis: ['./src/routes/*.js', './src/models/*.js', './src/controllers/*.js'], // Paths to files containing OpenAPI definitions
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;
