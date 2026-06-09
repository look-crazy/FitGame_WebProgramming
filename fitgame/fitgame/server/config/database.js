/**
 * MongoDB 데이터베이스 연결 설정
 * Mongoose를 사용하여 MongoDB에 연결합니다.
 */

const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // MongoDB 연결 옵션
    const options = {
      // 연결 타임아웃 설정 (10초)
      serverSelectionTimeoutMS: 10000,
      // 소켓 타임아웃 (45초)
      socketTimeoutMS: 45000,
    };

    const conn = await mongoose.connect(process.env.MONGODB_URI, options);

    console.log(`✅ MongoDB 연결 성공: ${conn.connection.host}`);
    console.log(`📦 데이터베이스: ${conn.connection.name}`);

    // 연결 이벤트 리스너
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB 연결이 끊어졌습니다. 재연결 시도 중...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB 재연결 성공');
    });

    return conn;
  } catch (error) {
    console.error('❌ MongoDB 연결 실패:', error.message);
    console.error('💡 .env 파일의 MONGODB_URI를 확인하세요.');
    throw error;
  }
};

module.exports = connectDB;
