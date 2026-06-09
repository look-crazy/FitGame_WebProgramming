/**
 * MongoDB 데이터베이스 연결 설정
 */

const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    console.log('MONGODB_URI 존재 여부:', !!process.env.MONGODB_URI);

    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000
    });

    console.log('MongoDB 연결 성공:', conn.connection.host);
    console.log('데이터베이스:', conn.connection.name);

    return conn;
  } catch (error) {
    console.error('MongoDB 연결 실패 전체 에러');
    console.error(error);

    throw error;
  }
};

module.exports = connectDB;