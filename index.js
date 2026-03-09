import 'dotenv/config';
import { Rcon } from 'rcon-client';
import {
    Client,
    GatewayIntentBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    MessageFlags
} from 'discord.js';
import { query } from "./db.js";
import { existsSync, readFileSync, watch } from 'fs';
import { join } from 'path';
import deleteItemFromPlayer from './delete_item.js';

// 📦 Import หน้าตาและราคาจากไฟล์ ui_setup.js
import { 
    shopPrices, 
    setupRegisterChannel, 
    setupBotCommandChannel, 
    setupBagBotShopChannel, 
    setupMaleeBotShopChannel, 
    setupClothingBotShopChannel 
} from './ui_setup.js';

const welcomePack_value = 500;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// --- RCON Function ---
async function sendCommand(cmd) {
    try {
        const rcon = await Rcon.connect({
            host: "127.0.0.1",
            port: parseInt(process.env.RCON_PORT),
            password: process.env.RCON_PASSWORD
        });
        const response = await rcon.send(cmd);
        await rcon.end();
        return response;
    } catch (err) {
        console.error("❌ RCON Connection Failed:", err.message);
        return null;
    }
}

client.once('ready', () => {
    console.log(`✅ Bot ${client.user.tag} is Online!`);
    sendCommand('servermsg "System: Node.js Bot is now Online!"');
});

// --- Message Commands ---
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content === '!setup-reg') {
        await setupRegisterChannel(message);
        await message.delete();
    }
    if (message.content === '!setup-botcmd') {
        await setupBotCommandChannel(message);
        await message.delete();
    }
    if (message.content === '!setup-bag-bs') {
        await setupBagBotShopChannel(message);
        await message.delete();
    }
    if (message.content === '!setup-malee-bs') {
        await setupMaleeBotShopChannel(message);
        await message.delete();
    }
    if (message.content === '!setup-clothing-bs') {
        await setupClothingBotShopChannel(message);
        await message.delete();
    }

    if (message.content === '!shop') {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('open_reg_modal')
                .setLabel('ลงทะเบียนตัวละคร')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('buy_axe_btn')
                .setLabel(`ซื้อขวาน (${shopPrices.axe})`)
                .setEmoji('🪓')
                .setStyle(ButtonStyle.Success)
        );

        await message.reply({
            content: '🛒 ยินดีต้อนรับสู่ร้านค้า PZ! เลือกรายการด้านล่าง:',
            components: [row]
        });
    }

    if (message.content === '!status') {
        const res = await sendCommand("players");
        message.reply(`🌐 รายชื่อคนในเซิร์ฟเวอร์:\n${res || "ติดต่อเซิร์ฟเวอร์ไม่ได้"}`);
    }
});

// --- Interaction Handling (Buttons & Modals) ---
client.on('interactionCreate', async (interaction) => {

    // Helper ย่อยสำหรับเช็คยอดเงินตอนซื้อของ (ลดโค้ดซ้ำ)
    const handlePurchase = async (price, itemID, itemName) => {
        const res = await query(`SELECT player_name, coin FROM public.data WHERE discord_id = $1`, [interaction.user.id]);
        if (res.rowCount === 0) {
            return interaction.reply({ content: "❌ ไม่พบข้อมูลการลงทะเบียนในระบบ", flags: MessageFlags.Ephemeral });
        }
        
        const player_data = res.rows[0];
        
        if (player_data.coin >= price) {
            await sendCommand(`additem "${player_data.player_name}" ${itemID} 1`);
            await query(`UPDATE public.data SET coin = coin - $1 WHERE discord_id = $2 AND player_name = $3`, [price, interaction.user.id, player_data.player_name]);
            const newCoin = (await query(`SELECT coin FROM public.data WHERE discord_id = $1`, [interaction.user.id])).rows[0].coin;
            
            interaction.reply({
                content: `✅ ส่ง ${itemName} ให้ตัวละคร **${player_data.player_name}** แล้ว!\nยอดเงินคงเหลือ: ${newCoin} CPE Dollars`,
                flags: MessageFlags.Ephemeral
            });
        } else {
            interaction.reply({
                content: `❌ You dont have enough CPE Dollars.`,
                flags: MessageFlags.Ephemeral
            });
        }
    };

    // ***************** BOT SHOP *******************
    if (interaction.isButton() && interaction.customId === 'buy_bigHikingBag') {
        await handlePurchase(shopPrices.bigHikingBag, 'Base.Bag_BigHikingBag', 'Big Hiking Bag');
    }

    if (interaction.isButton() && interaction.customId === 'buy_baseballBatNails') {
        await handlePurchase(shopPrices.baseballBatNails, 'Base.BaseballBatNails', 'Baseball Bat Nails');
    }

    if (interaction.isButton() && interaction.customId === 'buy_armyBoot') {
        await handlePurchase(shopPrices.armyBoots, 'Base.Shoes_ArmyBoots', 'Army Boots');
    }

    // **********************************************

    if (interaction.isButton() && interaction.customId === 'check_wallet') {
        const res = await query(`SELECT player_name, coin FROM public.data WHERE discord_id = $1`, [interaction.user.id]);
        if (res.rowCount === 0) return interaction.reply({ content: "ยังไม่ได้ลงทะเบียน", flags: MessageFlags.Ephemeral });
        
        const res_data = res.rows[0];
        interaction.reply({
            content: `💰 **${res_data.player_name}**'s balance: ${res_data.coin} ${res_data.coin > 1 ? "coins" : "coin"}`,
            flags: MessageFlags.Ephemeral
        });
    }

    if (interaction.isButton() && interaction.customId === 'open_reg_modal') {
        const modal = new ModalBuilder()
            .setCustomId('reg_modal')
            .setTitle('ลงทะเบียนตัวละคร');

        const pzNameInput = new TextInputBuilder()
            .setCustomId('pz_name_input')
            .setLabel("ชื่อตัวละครในเกม (In-game Name)")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('player')
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(pzNameInput));
        await interaction.showModal(modal);
    }

    if (interaction.isButton() && interaction.customId === 'player_online') {
        const res = await sendCommand("players");
        const match = res.match(/\((\d+)\)/); 
        const playerCount = parseInt(match ? match[1] : "0");
        interaction.reply({
            content: `${playerCount === 0 ? 'No Player online :(' : `🎮 ${playerCount} ${playerCount === 1 ? "Player" : "Players"} online!`}`,
            flags: [MessageFlags.Ephemeral]
        });
    }

    if (interaction.isButton() && interaction.customId === 'welcomePack') {
        try {
            const discord_id = interaction.user.id;
            const welcomePack_item = [
                ['Base.BeefJerky', 2],
                ['Base.Baloney', 1],
                ['Base.PopBottle', 2],
            ];

            const res = await query(`SELECT player_name, is_welcomepack FROM public.data WHERE discord_id = $1`, [discord_id]);
            if (res.rowCount === 0) {
                return interaction.reply({ content: "❌ ไม่พบข้อมูลการลงทะเบียนในระบบ", flags: [MessageFlags.Ephemeral] });
            }

            const player_data = {
                ig_name: res.rows[0].player_name,
                isWelcomePack: res.rows[0].is_welcomepack
            };

            if (player_data.isWelcomePack === true) {
                return interaction.reply({ content: `❌ Player **${player_data.ig_name}** has already claimed the Welcome Pack.`, flags: [MessageFlags.Ephemeral] });
            }

            for (let i = 0; i < welcomePack_item.length; i++) {
                await sendCommand(`additem "${player_data.ig_name}" ${welcomePack_item[i][0]} ${welcomePack_item[i][1]}`);
            }

            await query(`UPDATE public.data SET is_welcomepack = $1, coin = $2 WHERE discord_id = $3`, [true, welcomePack_value, discord_id]);

            await interaction.reply({
                content: `✅ Sending Welcome Pack to **${player_data.ig_name}**\nReceived ${welcomePack_value} coins to your wallet!`,
                flags: [MessageFlags.Ephemeral]
            });
        } catch (err) {
            console.error("Welcome Pack Error:", err);
            if (!interaction.replied) {
                await interaction.reply({ content: "เกิดข้อผิดพลาดภายในระบบ", flags: [MessageFlags.Ephemeral] });
            }
        }
    }

    if (interaction.isButton() && interaction.customId === 'buy_axe_btn') {
        await handlePurchase(shopPrices.axe, 'Base.Axe', 'Axe');
    }

    if (interaction.isModalSubmit() && interaction.customId === 'reg_modal') {
        const pzName = interaction.fields.getTextInputValue('pz_name_input');
        const discordId = interaction.user.id;
        try {
            await query(`INSERT INTO public.data (discord_id, player_name, coin) VALUES ($1, $2, $3);`, [discordId, pzName, 0]);
            await interaction.reply({ content: `✅ ลงทะเบียนชื่อ **${pzName}** สำเร็จ!`, flags: MessageFlags.Ephemeral });
        } catch (err) {
            console.error(err);
            await interaction.reply({ content: '❌ บันทึกข้อมูลไม่สำเร็จ อาจจะลงทะเบียนไปแล้ว', flags: MessageFlags.Ephemeral });
        }
    }
});

client.login(process.env.BOT_TOKEN).catch(err => console.error("❌ Discord Login Failed:", err.message));

// ==========================================
// 🔄 Log Watcher (ระบบเฝ้าดูไอเทม)
// ==========================================

const move_CPE_Dollar_to_wallet = async (player_name, data) => {
    const items = data[player_name];
    if (items) {
        let dollar_count = 0;
        for (let i = 0; i < items.length; i++) {
            if (items[i] === 'Base.CPE_Dollar') {
                dollar_count += 1;
            }
        }
        if (dollar_count > 0) {
            console.log(`Player ${player_name} has ${dollar_count} Dollars`);
            await query(`UPDATE public.data SET coin = coin + $1 WHERE player_name = $2`, [dollar_count, player_name]);
            deleteItemFromPlayer(player_name, 'Base.CPE_Dollar', dollar_count);
        }
    }
};

const logsFolder = 'C:\\Users\\Mhek3\\Zomboid\\Logs';

function parseZomboidLog(targetFilePath) {
    if (!existsSync(targetFilePath)) {
        console.log(`⚠️ อ่านไฟล์ไม่ได้ หรือหาไฟล์ไม่พบ: ${targetFilePath}`);
        return null;
    }

    const fileContent = readFileSync(targetFilePath, 'utf-8');
    const lines = fileContent.split(/\r?\n/);
    const playersData = {};
    let player_name;

    lines.forEach((line) => {
        if (line.includes('[PLAYER]:') && line.includes('[ITEMS]:')) {
            const match = line.match(/\[PLAYER\]:(.*?)\s+\[ITEMS\]:(.*)/);
            if (match) {
                player_name = match[1].trim();
                let itemsString = match[2].trim();
                itemsString = itemsString.replace(/\.$/, '').trim();
                playersData[player_name] = itemsString ? itemsString.split(',') : [];
            }
        }
    });
    return { player_name: player_name, playersData: playersData };
}

console.log(`\n👀 กำลังเฝ้าดูการเคลื่อนไหวในโฟลเดอร์: ${logsFolder}...`);

watch(logsFolder, (eventType, filename) => {
    if (filename && filename.includes('ITEM_DATA_EXPORT')) {
        const exactFilePath = join(logsFolder, filename);
        console.log(`\n🟢 ตรวจพบการทำงานที่ไฟล์จริงชื่อ: ${filename}`);

        setTimeout(() => {
            const updatedData = parseZomboidLog(exactFilePath);
            if (updatedData && Object.keys(updatedData.playersData).length > 0) {
                console.log("=== 📦 ข้อมูลไอเทมล่าสุด ===");
                console.log(JSON.stringify(updatedData, null, 2));
                move_CPE_Dollar_to_wallet(updatedData.player_name, updatedData.playersData);
            }
        }, 50);
    }
});