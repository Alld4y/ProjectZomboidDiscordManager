import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// สร้างฟังก์ชันหลักที่จะถูกเรียกจาก index.js
export const initIPChecker = (client) => {
    
    const IP_NOTIFY_CHANNEL_ID = '1481743528852717789'; 
    const IP_CACHE_FILE = join(process.cwd(), 'last_ip.txt');

    const checkAndNotifyIP = async () => {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const { ip: currentIP } = await response.json();

            let lastIP = '';
            if (existsSync(IP_CACHE_FILE)) {
                lastIP = readFileSync(IP_CACHE_FILE, 'utf-8').trim();
            }

            // ปรับในส่วนการลบข้อความ
            if (currentIP !== lastIP) {
                const channel = await client.channels.fetch(IP_NOTIFY_CHANNEL_ID);
                if (channel) {
                    try {
                        // ดึงข้อความล่าสุดมา 5 ข้อความ (ปกติห้องนี้จะมีแค่ 1 อันอยู่แล้ว)
                        const messages = await channel.messages.fetch({ limit: 5 });
                        
                        // วนลบทิ้งทีละข้อความ (วิธีนี้ลบได้แม้จะเก่าเกิน 14 วัน)
                        for (const msg of messages.values()) {
                            await msg.delete().catch(() => {}); 
                        }

                        // ส่งอันใหม่
                        await channel.send(`🌐 **Server IP!**\n**IP:** \`${currentIP}\` \n**Port:** \`16261\``);
                        writeFileSync(IP_CACHE_FILE, currentIP, 'utf-8');
                        
                    } catch (err) {
                        console.error('Delete/Send Error:', err.message);
                    }
                }
            }
        } catch (err) {
            console.error('[IP Check Error]:', err.message);
        }
    };

    // ตั้งเวลาเช็คทุก 10 นาที
    setInterval(checkAndNotifyIP, 10 * 60 * 1000);
    
    // รันครั้งแรกทันทีที่เปิดบอท
    checkAndNotifyIP();
};