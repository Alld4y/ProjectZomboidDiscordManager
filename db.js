import pkg from 'pg';
import dotenv from 'dotenv'
const { Pool } = pkg;
dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL, 
});

// --- เพิ่มส่วนนี้เพื่อดัก Error ไม่ให้ App Crash ---
pool.on('error', (err) => {
    // ให้มันแสดงแค่ Error ใน Console ของฝั่ง Server
    // ป้องกันไม่ให้ตัวโปรแกรมสั่ง throw จนระบบล่ม
    console.error('❌ Unexpected Database Error:', err.message);
});
// ----------------------------------------------

// ฟังก์ชันสำหรับรัน Query
export const query = (text, params) => pool.query(text, params);

export default pool;