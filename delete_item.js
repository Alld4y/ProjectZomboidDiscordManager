import { appendFileSync } from 'fs';
import { join } from 'path';

const luaFolder = 'C:\\Users\\Mhek3\\Zomboid\\Lua';
const queueFile = join(luaFolder, 'delete_items_queue.txt');

// 📦 เพิ่มพารามิเตอร์ quantity และตั้งค่าเริ่มต้นเป็น 1
export default function deleteItemFromPlayer(username, itemFullName, quantity = 1) {
    // 📝 อัปเดตรูปแบบคำสั่งใหม่: ชื่อ,ไอเทม,จำนวน (คั่นด้วยลูกน้ำ)
    const commandLine = `${username},${itemFullName},${quantity}\n`;
    
    try {
        appendFileSync(queueFile, commandLine, 'utf-8');
        console.log(`📡 ส่งคำสั่งลบ [${itemFullName}] จำนวน ${quantity} ชิ้น ของ [${username}] เข้าคิวแล้ว!`);
    } catch (error) {
        console.error("❌ เกิดข้อผิดพลาดในการส่งคำสั่ง:", error);
    }
}

// ==========================================
// ทดลองใช้งาน
// ==========================================

// ลบขวดน้ำ 1 ขวด (ไม่ใส่เลขจำนวน มันจะใช้ค่าเริ่มต้นคือ 1 อัตโนมัติ)
// deleteItemFromPlayer('Pla2na', 'Base.PopBottle');

// ลบเงิน CPE_Dollar จำนวน 500 ใบ (ระบุเลขจำนวนไปเลย)
// deleteItemFromPlayer('Pla2na', 'Base.CPE_Dollar', 500);