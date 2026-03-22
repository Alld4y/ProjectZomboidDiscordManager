import cron from 'node-cron';
import { query } from './db.js';

// สั่งให้บอทส่งข้อความแจ้งเตือนในเซิร์ฟเวอร์ทุกชั่วโมง
export const dailyRewardReset = cron.schedule('0 0 * * *', async () => {
  await query(`UPDATE public.data SET daily_reward = false`); // ตั้งค่า daily_reward เป็น false สำหรับทุกคนในฐานข้อมูล
  console.log("🔄 Daily Reward reset: All players can claim their daily reward again.");
});