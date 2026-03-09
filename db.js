import pkg from 'pg';
import dotenv from 'dotenv'
const { Pool } = pkg;
dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL, // ใช้ URL ที่ได้จากขั้นตอนที่แล้ว
});

// ฟังก์ชันสำหรับรัน Query
export const query = (text, params) => pool.query(text, params);

export default pool;