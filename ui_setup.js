import { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } from 'discord.js';

export const embedColor = 0x0099FF;

// 💰 รวมราคาสินค้าไว้ที่นี่ที่เดียว
export const shopPrices = {
    bigHikingBag: 250,
    baseballBatNails: 100,
    armyBoots: 150,
    axe: 500 // เพิ่มราคาขวานเข้ามาด้วย
};

// ==========================================
// 🛠️ UI Helper Functions
// ==========================================
export const createEmbed = (title, description, imageUrl = null, color = embedColor) => {
    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(description);
    if (imageUrl) embed.setImage(imageUrl);
    return embed;
};

export const createButton = (customId, label, style, emoji = null) => {
    const btn = new ButtonBuilder()
        .setCustomId(customId)
        .setLabel(label)
        .setStyle(style);
    if (emoji) btn.setEmoji(emoji);
    return btn;
};

export const createRow = (...buttons) => {
    return new ActionRowBuilder().addComponents(...buttons);
};

// ==========================================
// 📢 Channel Setup Functions
// ==========================================
export const setupRegisterChannel = async (message) => {
    const embed = createEmbed(
        '📝 ลงทะเบียนผู้เล่น Project Zomboid',
        'กรุณากดปุ่มด้านล่างเพื่อผูกบัญชี Discord เข้ากับชื่อตัวละครในเกม\n\n*หมายเหตุ: โปรดใช้ชื่อเดียวกับที่ใช้ในเซิร์ฟเวอร์*'
    );
    const row = createRow(
        createButton('open_reg_modal', 'เริ่มการลงทะเบียน', ButtonStyle.Primary, '✍️'),
        createButton('welcomePack', 'Welcome Pack', ButtonStyle.Success, '🎁')
    );
    await message.channel.send({ embeds: [embed], components: [row] });
};

export const setupBotCommandChannel = async (message) => {
    const embed = createEmbed('Bot Command', 'เรียกใช้งานบอท');
    const row = createRow(
        createButton('player_online', 'Player Online', ButtonStyle.Secondary, '🧍🏾'),
        createButton('check_wallet', 'Wallet', ButtonStyle.Primary, '🪙')
    );
    await message.channel.send({ embeds: [embed], components: [row] });
};

export const setupBagBotShopChannel = async (message) => {
    const embed = createEmbed(
        "Big Hiking Bag",
        "กระเป๋าเป้สะพายหลังขนาดใหญ่สำหรับการเดินป่าเป็นอุปกรณ์บรรจุสิ่งของที่สามารถสะพายได้\n\nA big hiking backpack is a wearable container item.",
        'https://pzwiki.net/w/images/2/28/BigHikingBag_Blue_Model.png'
    );
    const row = createRow(createButton('buy_bigHikingBag', `Big Hiking Bag : ${shopPrices.bigHikingBag}`, ButtonStyle.Success, '🛍️'));
    await message.channel.send({ embeds: [embed], components: [row] });
};

export const setupMaleeBotShopChannel = async (message) => {
    const embed = createEmbed(
        "Baseball Bat Nails",
        "ไม้เบสบอลที่มีตะปูสามารถใช้เป็นอาวุธได้ โดยจะเพิ่มระดับความยากตามทักษะการทุบตีระยะไกล\n\nA baseball bat with nails can be used as a weapon, scaling with the long blunt skill.",
        'https://static.wikia.nocookie.net/projectzomboid/images/9/92/Spiked_baseball_bat_inv.png/revision/latest?cb=20110714001632'
    );
    const row = createRow(createButton('buy_baseballBatNails', `Baseball Bat Nail : ${shopPrices.baseballBatNails}`, ButtonStyle.Success, '🛍️'));
    await message.channel.send({ embeds: [embed], components: [row] });
};

export const setupClothingBotShopChannel = async (message) => {
    const embed = createEmbed(
        "Army Boots",
        "รองเท้าทหารเป็นรองเท้าสีดำที่ทหารสวมใส่กันทั่วไป\n\nA military boots are black colored boots commonly worn by soldiers.",
        'https://pzwiki.net/w/images/3/3b/BootsArmy_Model.png'
    );
    const row = createRow(createButton('buy_armyBoot', `Army Boots : ${shopPrices.armyBoots}`, ButtonStyle.Success, '🛍️'));
    await message.channel.send({ embeds: [embed], components: [row] });
};