const mongoose = require('mongoose');

async function connectDB() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('MONGO_URI is missing. Set it in backend/.env');
  }

  await mongoose.connect(mongoUri, {
    dbName: process.env.MONGO_DB_NAME || 'msa_agency',
  });

  // eslint-disable-next-line no-console
  console.log('MongoDB connected');
}

module.exports = connectDB;
