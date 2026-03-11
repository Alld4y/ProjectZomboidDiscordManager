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
    setupClothingBotShopChannel,
    setupGeneralBotShopChannel,
    setupRoleClaimChannel
} from './ui_setup.js';

const welcomePack_value = 500; // จำนวนเงินที่ให้เมื่อรับ Welcome Pack

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

// --- Helper: Check if Player is Online ---
async function checkPlayerOnline(playerName) {
    const res = await sendCommand("players");
    if (!res) return false;

    // ตัดแค่ช่องว่างหัว-ท้าย เพราะ PZ Username ซีเรียสเรื่องตัวพิมพ์เล็ก-ใหญ่
    const targetName = playerName.trim();

    const onlinePlayers = res.split('\n')
        .map(line => line.trim())
        .filter(line => line.startsWith('-')) 
        // ลบแค่เครื่องหมายลบข้างหน้าออก และเก็บ Case เดิมไว้
        .map(line => line.replace(/^-/, '').trim());

    console.log(`Checking if player "${targetName}" is online among:`, onlinePlayers);
    
    // การเปรียบเทียบตรงนี้จะเป็น Case-sensitive ทันที
    return onlinePlayers.includes(targetName);
}

client.once('clientReady', () => { 
    console.log(`✅ Bot ${client.user.tag} is Online!`);
    sendCommand('servermsg "System: Discord Bot is now Online!"');
});

// --- Message Commands ---
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // 🛡️ 1. จัดการกลุ่มคำสั่ง Setup (เฉพาะ Moderator/Admin)N
    const setupCommands = [
        '!setup-gnr-bs', '!setup-reg', '!setup-botcmd', 
        '!setup-bag-bs', '!setup-malee-bs', '!setup-clothing-bs', '!setup-role'
    ];

    if (message.content === '!setup-role') await setupRoleClaimChannel(message);

    if (setupCommands.includes(message.content)) {
        // เช็คสิทธิ์: ต้องมีสิทธิ์จัดการเซิร์ฟเวอร์ (Manage Server)
        if (!message.member.permissions.has('ManageGuild')) {
            const reply = await message.reply({ 
                content: '❌ เฉพาะแอดมินหรือมอดเดอเรเตอร์เท่านั้นที่ใช้คำสั่งตั้งค่าได้ครับ!', 
                flags: [MessageFlags.Ephemeral] 
            });
            // ลบคำสั่งที่พิมพ์มาเพื่อความสะอาด (ถ้าบอทมีสิทธิ์)
            return setTimeout(() => message.delete().catch(() => {}), 3000);
        }

        // รันฟังก์ชันตามคำสั่งที่พิมพ์
        if (message.content === '!setup-gnr-bs') await setupGeneralBotShopChannel(message);
        else if (message.content === '!setup-reg') await setupRegisterChannel(message);
        else if (message.content === '!setup-botcmd') await setupBotCommandChannel(message);
        else if (message.content === '!setup-bag-bs') await setupBagBotShopChannel(message);
        else if (message.content === '!setup-malee-bs') await setupMaleeBotShopChannel(message);
        else if (message.content === '!setup-clothing-bs') await setupClothingBotShopChannel(message);

        // ลบข้อความคำสั่งหลังจากตั้งค่าเสร็จ
        await message.delete().catch(() => {});
        return;
    }

    // 🗑️ 2. คำสั่ง !clear (คงเดิมไว้และเพิ่มการป้องกัน Error)
    if (message.content.startsWith('!clear')) {
        if (!message.member.permissions.has('ManageMessages')) {
            return message.reply({ content: '❌ คุณไม่มีสิทธิ์ลบข้อความครับ!', flags: [MessageFlags.Ephemeral] });
        }

        const args = message.content.split(' ');
        const amount = args[1] ? parseInt(args[1]) : 100;

        if (isNaN(amount) || amount < 1 || amount > 100) {
            return message.reply({ content: '❌ กรุณาใส่ตัวเลขระหว่าง 1-100', flags: [MessageFlags.Ephemeral] });
        }

        try {
            const deleted = await message.channel.bulkDelete(amount, true);
            const replyMsg = await message.channel.send(`ลบหน้าต่าง UI เก่าทิ้งไป ${deleted.size} ข้อความ`);
            setTimeout(() => replyMsg.delete().catch(() => {}), 3000);
        } catch (err) {
            console.error(err);
            message.channel.send('❌ เกิดข้อผิดพลาด ไม่สามารถลบข้อความได้');
        }
        return;
    }

    // 🛒 3. คำสั่งทั่วไปสำหรับผู้เล่น (!shop, !status)
    if (message.content === '!shop') {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('open_reg_modal')
                .setLabel('ลงทะเบียนตัวละคร')
                .setStyle(ButtonStyle.Primary),
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

    const handlePurchase = async (price, itemID, itemName) => {
        const res = await query(`SELECT player_name, coin FROM public.data WHERE discord_id = $1`, [interaction.user.id]);
        if (res.rowCount === 0) {
            return interaction.reply({ content: "❌ ไม่พบข้อมูลการลงทะเบียนในระบบ", flags: [MessageFlags.Ephemeral] });
        }
        
        const player_data = res.rows[0];

        const isOnline = await checkPlayerOnline(player_data.player_name);
        if (!isOnline) {
            return interaction.reply({ 
                content: `❌ การสั่งซื้อล้มเหลว: ตัวละคร **${player_data.player_name}** ไม่ได้ออนไลน์อยู่ในเซิร์ฟเวอร์\n*(กรุณาเข้าเกมก่อนกดซื้อสินค้าเพื่อป้องกันไอเทมสูญหาย)*`, 
                flags: [MessageFlags.Ephemeral] 
            });
        }
        
        if (player_data.coin >= price) {
            await sendCommand(`additem "${player_data.player_name}" ${itemID} 1`);
            await query(`UPDATE public.data SET coin = coin - $1 WHERE discord_id = $2 AND player_name = $3`, [price, interaction.user.id, player_data.player_name]);
            const newCoin = (await query(`SELECT coin FROM public.data WHERE discord_id = $1`, [interaction.user.id])).rows[0].coin;
            
            interaction.reply({
                content: `✅ ส่ง ${itemName} ให้ตัวละคร **${player_data.player_name}** แล้ว!\nยอดเงินคงเหลือ: ${newCoin} CPE Dollars`,
                flags: [MessageFlags.Ephemeral]
            });
        } else {
            interaction.reply({
                content: `❌ You dont have enough CPE Dollars.`,
                flags: [MessageFlags.Ephemeral]
            });
        }
    };

    if (interaction.isButton() && interaction.customId === 'claim_cpe_pjz_role') {
    const roleName = "CPE_PJZ";
    // ค้นหา Role ในเซิร์ฟเวอร์
    const role = interaction.guild.roles.cache.find(r => r.name === roleName);

    if (!role) {
        return interaction.reply({ 
            content: `❌ ไม่พบยศ **${roleName}** ในเซิร์ฟเวอร์นี้ (กรุณาให้ Admin สร้างยศก่อน)`, 
            flags: [MessageFlags.Ephemeral] 
        });
    }

    try {
        // เช็คว่าเขามียศอยู่แล้วหรือยัง
        if (interaction.member.roles.cache.has(role.id)) {
            return interaction.reply({ 
                content: `✅ คุณมียศ **${roleName}** อยู่แล้วครับ!`, 
                flags: [MessageFlags.Ephemeral] 
            });
        }

        // มอบยศ
        await interaction.member.roles.add(role);
        await interaction.reply({ 
            content: `🎉 ยินดีด้วย! คุณได้รับยศ **${roleName}** เรียบร้อยแล้ว`, 
            flags: [MessageFlags.Ephemeral] 
        });

    } catch (err) {
        console.error("Role Claim Error:", err);
        interaction.reply({ 
            content: '❌ บอทไม่มีสิทธิ์มอยยศให้ (โปรดเช็คว่า Role ของบอทอยู่สูงกว่า Role ที่จะมอบ)', 
            flags: [MessageFlags.Ephemeral] 
        });
    }
}

    // ***************** BOT SHOP *******************
    // General Shop
    if (interaction.isButton() && interaction.customId === 'buy_CPE_Dollar') {
        const modal = new ModalBuilder()
            .setCustomId('buy_cpe_dollar_modal')
            .setTitle('ซื้อ CPE_Dollar');

        const amountInput = new TextInputBuilder()
            .setCustomId('cpe_dollar_amount_input')
            .setLabel("จำนวน CPE_Dollar (2 Coin = 1 CPE_Dollar)")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('เช่น 10')
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
        await interaction.showModal(modal);
    }
    if (interaction.isButton() && interaction.customId === 'buy_cigarette') {
        await handlePurchase(shopPrices.cigarette, 'Base.Cigarettes', 'Cigarette');
    }
    if (interaction.isButton() && interaction.customId === 'buy_skill_rc_book') {
        await handlePurchase(shopPrices.skill_rc_book, 'Base.SkillRecoveryBoundJournal', 'Bound Journal');
    }

    // Bag Shop
    if (interaction.isButton() && interaction.customId === 'buy_bigHikingBag') {
        await handlePurchase(shopPrices.bigHikingBag, 'Base.Bag_BigHikingBag', 'Big Hiking Bag');
    }
    // Malee Shop
    if (interaction.isButton() && interaction.customId === 'buy_baseballBatNails') {
        await handlePurchase(shopPrices.baseballBatNails, 'Base.BaseballBatNails', 'Baseball Bat Nails');
    }
    // Clothing Shop
    if (interaction.isButton() && interaction.customId === 'buy_camoJacket') {
        await handlePurchase(shopPrices.camoJacket, `Base.Jacket_ArmyCamo${Math.random() > 0.5 ? 'Green' : 'Desert'}`, 'Jacket - Hunting Camo');
    }
    if (interaction.isButton() && interaction.customId === 'buy_firemanJacket') {
        await handlePurchase(shopPrices.firemanJacket, 'Base.Jacket_Fireman', 'Jacket - Fireman');
    }
    if (interaction.isButton() && interaction.customId === 'buy_crashHelmet') {
        await handlePurchase(shopPrices.crashHelmet, 'Base.Hat_CrashHelmetFULL', 'Crash Helmet Full');
    }
    if (interaction.isButton() && interaction.customId === 'buy_armyBoot') {
        await handlePurchase(shopPrices.armyBoots, 'Base.Shoes_ArmyBoots', 'Army Boots');
    }

    // **********************************************

    if (interaction.isButton() && interaction.customId === 'check_wallet') {
        const res = await query(`SELECT player_name, coin FROM public.data WHERE discord_id = $1`, [interaction.user.id]);
        if (res.rowCount === 0) return interaction.reply({ content: "ยังไม่ได้ลงทะเบียน", flags: [MessageFlags.Ephemeral] });
        
        const res_data = res.rows[0];
        interaction.reply({
            content: `💰 **${res_data.player_name}**'s balance: ${res_data.coin} ${res_data.coin > 1 ? "coins" : "coin"}`,
            flags: [MessageFlags.Ephemeral]
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

            console.log(`Player ${player_data.ig_name} is trying to claim Welcome Pack. Already claimed? ${player_data.isWelcomePack}`);

            if (player_data.isWelcomePack === true) {
                return interaction.reply({ content: `❌ Player **${player_data.ig_name}** ได้รับ Welcome Pack ไปแล้วครับ`, flags: [MessageFlags.Ephemeral] });
            }

            const isOnline = await checkPlayerOnline(player_data.ig_name);
            if (!isOnline) {
                return interaction.reply({ 
                    content: `❌ การรับของล้มเหลว: ตัวละคร **${player_data.ig_name}** ไม่ได้ออนไลน์อยู่ในเซิร์ฟเวอร์\n*(กรุณาเข้าเกมก่อนกดรับ Welcome Pack)*`, 
                    flags: [MessageFlags.Ephemeral] 
                });
            }

            for (let i = 0; i < welcomePack_item.length; i++) {
                await sendCommand(`additem "${player_data.ig_name}" ${welcomePack_item[i][0]} ${welcomePack_item[i][1]}`);
            }

            // อัปเดตสถานะการรับของ แต่ไม่ต้องบวกเงินเพิ่มแล้ว
            await query(`UPDATE public.data SET is_welcomepack = $1, coin=$2 WHERE discord_id = $3`, [true, welcomePack_value, discord_id]);

            await interaction.reply({
                content: `✅ ส่งไอเทม Welcome Pack ให้ตัวละคร **${player_data.ig_name}** เรียบร้อยแล้ว!`,
                flags: [MessageFlags.Ephemeral]
            });
        } catch (err) {
            console.error("Welcome Pack Error:", err);
            if (!interaction.replied) {
                await interaction.reply({ content: "เกิดข้อผิดพลาดภายในระบบ", flags: [MessageFlags.Ephemeral] });
            }
        }
    }

    if (interaction.isModalSubmit() && interaction.customId === 'reg_modal') {
        const pzName = interaction.fields.getTextInputValue('pz_name_input').trim();
        const discordId = interaction.user.id;
        
        try {
            // 1. เช็คว่า Discord นี้ลงทะเบียนไปหรือยัง
            const checkDiscord = await query(`SELECT player_name FROM public.data WHERE discord_id = $1`, [discordId]);
            if (checkDiscord.rowCount > 0) {
                return interaction.reply({ 
                    content: `❌ คุณลงทะเบียนไปแล้วด้วยชื่อ **${checkDiscord.rows[0].player_name}**\n*(1 Discord ผูกได้แค่ 1 ตัวละคร)*`, 
                    flags: [MessageFlags.Ephemeral] 
                });
            }

            // 2. เช็คว่าชื่อในเกมนี้ มีคนใช้งานไปแล้วหรือยัง (เช็คแบบฉลาด ไม่สนตัวพิมพ์เล็กใหญ่)
            const checkName = await query(`SELECT discord_id FROM public.data WHERE LOWER(player_name) = LOWER($1)`, [pzName]);
            if (checkName.rowCount > 0) {
                return interaction.reply({ 
                    content: `❌ ชื่อตัวละคร **${pzName}** มีผู้เล่นอื่นใช้งานแล้วครับ!\n*(กรุณาเปลี่ยนชื่อตัวละครใหม่ในเกม แล้วค่อยมากดลงทะเบียนอีกครั้ง)*`, 
                    flags: [MessageFlags.Ephemeral] 
                });
            }

            // 3. ถ้าผ่านทั้งหมด ค่อยให้ลงทะเบียน
            await query(`INSERT INTO public.data (discord_id, player_name, coin) VALUES ($1, $2, $3);`, [discordId, pzName, 0]);
            await interaction.reply({ content: `✅ ลงทะเบียนชื่อ **${pzName}** สำเร็จ! ขอให้สนุกกับ Project Zomboid นะครับ`, flags: [MessageFlags.Ephemeral] });
            const registered_role = interaction.guild.roles.cache.find(r => r.name === "Registered");
            await interaction.member.roles.add(registered_role);
        } catch (err) {
            console.error(err);
            await interaction.reply({ content: '❌ บันทึกข้อมูลไม่สำเร็จ เกิดข้อผิดพลาดในระบบฐานข้อมูล', flags: [MessageFlags.Ephemeral] });
        }
    }

    if (interaction.isModalSubmit() && interaction.customId === 'buy_cpe_dollar_modal') {
        const amount = parseInt(interaction.fields.getTextInputValue('cpe_dollar_amount_input'));
        const discordId = interaction.user.id;
        
        if (isNaN(amount) || amount <= 0) {
            return interaction.reply({ content: '❌ กรุณากรอกจำนวนเป็นตัวเลขที่มากกว่า 0', flags: [MessageFlags.Ephemeral] });
        }

        try {
            const res = await query(`SELECT player_name, coin FROM public.data WHERE discord_id = $1`, [discordId]);
            if (res.rowCount === 0) {
                return interaction.reply({ content: "❌ ไม่พบข้อมูลการลงทะเบียนในระบบ", flags: [MessageFlags.Ephemeral] });
            }

            const playerName = res.rows[0].player_name;
            const playerCoin = res.rows[0].coin;

            const isOnline = await checkPlayerOnline(playerName);
            if (!isOnline) {
                return interaction.reply({ 
                    content: `❌ การทำรายการล้มเหลว: ตัวละคร **${playerName}** ไม่ได้ออนไลน์อยู่ในเซิร์ฟเวอร์\n*(กรุณาเข้าเกมก่อนกดซื้อเพื่อป้องกันเงินสูญหาย)*`, 
                    flags: [MessageFlags.Ephemeral] 
                });
            }

            if (playerCoin < amount * 2) {
                return interaction.reply({ content: `❌ ยอดเงินในกระเป๋าไม่เพียงพอ คุณมี ${playerCoin} coins`, flags: [MessageFlags.Ephemeral] });
            }

            await query(`UPDATE public.data SET coin = coin - $1 WHERE discord_id = $2`, [amount * 2, discordId]);
            await sendCommand(`additem "${playerName}" Base.CPE_Dollar ${amount}`);
            await interaction.reply({ content: `✅ ซื้อ CPE_Dollar จำนวน ${amount} สำเร็จ!`, flags: [MessageFlags.Ephemeral] });
        } catch (err) {
            console.error("Buy CPE_Dollar Error:", err);
            if (!interaction.replied) {
                await interaction.reply({ content: "เกิดข้อผิดพลาดภายในระบบ", flags: [MessageFlags.Ephemeral] });
            }
        }
    }
});

client.login(process.env.BOT_TOKEN).catch(err => console.error("❌ Discord Login Failed:", err.message));

// ==========================================
// 🔄 Log Watcher (ระบบเฝ้าดูไอเทม)
// ==========================================

import { appendFileSync, writeFileSync } from 'fs';

// --- ตั้งค่า Path ให้ตรงกับเครื่องของคุณ ---
const logsFolder = 'C:\\Users\\Mhek3\\Zomboid\\Logs';
const confirmFile = 'C:\\Users\\Mhek3\\Zomboid\\Lua\\confirm_queue.txt';

/**
 * 1. ฟังก์ชันจัดการ Database และส่งคำยืนยัน
 */
const move_Currency_to_wallet = async (txid, playerName, dollarCount, moneyCount) => {
    try {
        const totalBonus = (dollarCount * 2) + (moneyCount * 1);
        if (totalBonus <= 0) return;

        console.log(`\n[DB] ⏳ กำลังประมวลผล TXID: ${txid}`);
        
        // --- สมมติว่าอัปเดต DB สำเร็จแล้ว ---
        console.log(`[DB] ✅ เพิ่มเงินให้ ${playerName} จำนวน ${totalBonus} Coins สำเร็จ`);
        await query(`UPDATE public.data SET coin = coin + $1 WHERE player_name = $2`, [totalBonus, playerName]);

        // 2. เขียนไฟล์ยืนยัน (ใช้การต่อท้ายและ Flush ทันที)
        // เพิ่มเลข TXID และขึ้นบรรทัดใหม่
        try {
            appendFileSync(confirmFile, `${txid}\n`, 'utf-8');
            console.log(`[CONFIRM] ✉️ TXID: ${txid} เขียนลงไฟล์ยืนยันแล้ว`);
        } catch (err) {
            console.error(`❌ ไม่สามารถเขียนไฟล์ confirm ได้: ${err.message}`);
        }

    } catch (error) {
        console.error(`❌ DB Error: ${error.message}`);
    }
};

/**
 * 2. ฟังก์ชัน Parse Log แบบวนหาบรรทัดล่าสุดที่ถูกต้อง
 */
function parseZomboidLog(targetFilePath) {
    if (!existsSync(targetFilePath)) return null;

    try {
        // อ่านไฟล์ทั้งหมดมาแยกบรรทัด
        const fileContent = readFileSync(targetFilePath, 'utf-8');
        const lines = fileContent.trim().split(/\r?\n/);
        
        // วนจากล่างขึ้นบน เพื่อหาบรรทัดล่าสุดที่มีรูปแบบที่ถูกต้อง
        for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i];
            const regex = /\[TXID\]:(.*?)\s*\[PLAYER\]:(.*?)\s*\[CPE_DOLLAR\]:(\d+)\s*\[MONEY\]:(\d+)/;
            const match = line.match(regex);
            
            if (match) {
                return {
                    txid: match[1].trim(),
                    playerName: match[2].trim(),
                    dollarAmount: parseInt(match[3], 10),
                    moneyAmount: parseInt(match[4], 10)
                };
            }
        }
    } catch (err) {
        console.error("❌ อ่านไฟล์ Log ผิดพลาด:", err.message);
    }
    return null;
}

/**
 * 3. เริ่มต้น Watcher
 */
console.log(`\n🚀 Watcher Start! กำลังเฝ้าดูโฟลเดอร์: ${logsFolder}`);

// ตรวจสอบว่ามีไฟล์ confirm หรือยัง ถ้าไม่มีให้สร้างทิ้งไว้เพื่อป้องกัน Lua หาไม่เจอ
if (!existsSync(confirmFile)) {
    writeFileSync(confirmFile, '', 'utf-8');
    console.log(`[SYSTEM] 📂 สร้างไฟล์ confirm_queue.txt ใหม่`);
}

watch(logsFolder, (eventType, filename) => {
    if (filename && filename.includes('ITEM_DATA_EXPORT')) {
        const exactFilePath = join(logsFolder, filename);

        // รอ 500ms เพื่อให้แน่ใจว่า Disk เขียน Log เสร็จสมบูรณ์จริงๆ
        setTimeout(async () => {
            const data = parseZomboidLog(exactFilePath);
            if (data) {
                await move_Currency_to_wallet(data.txid, data.playerName, data.dollarAmount, data.moneyAmount);
            } else {
                console.log(`[SCAN] 👀 ไม่พบรูปแบบข้อมูลในไฟล์ ${filename}`);
            }
        }, 500); 
    }
});