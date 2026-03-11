import { appendFileSync } from 'fs';
import { join } from 'path';

const luaFolder = 'C:\\Users\\Mhek3\\Zomboid\\Lua';
const queueFile = join(luaFolder, 'delete_items_queue.txt');

export default function deleteItemFromPlayer(username, itemFullName, quantity = 1) {
    const commandLine = `${username},${itemFullName},${quantity}\n`;
    try {
        appendFileSync(queueFile, commandLine, 'utf-8');
        console.log(`📡 Queue: [${itemFullName}] x${quantity} for [${username}]`);
    } catch (error) {
        console.error("❌ Queue Error:", error);
    }
}