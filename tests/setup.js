const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;

// Setup in-memory MongoDB before all tests
beforeAll(async () => {
  // Disconnect any existing connection (from app.js auto-connecting)
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();

  // Set env vars BEFORE requiring the app
  process.env.MONGODB_URI = uri;
  process.env.JWT_SECRET = 'test-secret-key-for-testing-only-must-be-long-enough';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-for-testing-only';
  process.env.JWT_EXPIRE = '1h';
  process.env.JWT_REFRESH_EXPIRE = '7d';
  process.env.NODE_ENV = 'test';

  await mongoose.connect(uri);
}, 60000);

// Clear all collections after each test
afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

// Disconnect & stop in-memory server after all tests
afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  if (mongod) await mongod.stop();
}, 60000);

// Global helper: create user and return token
global.createUserAndGetToken = async (overrides = {}) => {
  const supertest = require('supertest');
  const { app } = require('../src/app');

  const userData = {
    name: 'Test User',
    email: `test${Date.now()}${Math.random().toString(36).slice(2)}@test.com`,
    password: 'Password1!',
    phone: '9876543210',
    role: 'user',
    ...overrides
  };

  const res = await supertest(app)
    .post('/api/auth/register')
    .send(userData);

  return {
    token: res.body.data?.accessToken,
    userId: res.body.data?._id,
    user: userData
  };
};

global.createHelperAndGetToken = async () => {
  return global.createUserAndGetToken({
    role: 'helper',
    email: `helper${Date.now()}${Math.random().toString(36).slice(2)}@test.com`
  });
};
