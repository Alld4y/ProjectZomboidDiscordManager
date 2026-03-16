import cron from 'node-cron';
import { sendCommand } from './index.js';

// ตั้งเวลารีสตาร์ท (ตัวอย่าง: ทุก 6 ชั่วโมง ที่นาทีที่ 0)
// '0 0,6,12,18 * * *'
export const restartScheduler = cron.schedule('55 23,5,11,17 * * *', async () => {
    console.log('🔄 [System] Starting scheduled restart process...');
    
    // 1. เตือนผู้เล่นล่วงหน้า 5 นาที
    await sendCommand('servermsg "Server will restart in 5 mins for maintenance"');
    
    // 2. เตือนอีกครั้งเมื่อเหลือ 1 นาที
    setTimeout(async () => {
        await sendCommand('servermsg "Final warning: Restarting in 1 minute!"');
    }, 240000); // 4 นาที (60 วินาทีก่อนปิด)

    // 3. ปิดเซิร์ฟเวอร์เมื่อครบ 5 นาที
    setTimeout(async () => {
        console.log('💾 Saving and Quitting...');
        await sendCommand('servermsg "Restarting now..."');
        await sendCommand('save'); // บังคับเซฟ World ป้องกันของหาย
        
        // รอให้เซฟเสร็จสัก 5 วินาทีแล้วค่อย Quit
        setTimeout(async () => {
            await sendCommand('quit'); 
            // เมื่อส่ง 'quit' -> Java Process จะปิด -> ไฟล์ .bat จะวนลูปไปที่ :start เองอัตโนมัติ
            console.log('✅ Quit command sent successfully.');
        }, 5000);
    }, 1000*60*5); // 5 นาที
});