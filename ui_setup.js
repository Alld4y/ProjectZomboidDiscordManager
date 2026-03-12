import { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } from 'discord.js';

export const embedColor = 0x0099FF;

// 💰 รวมราคาสินค้าไว้ที่นี่ที่เดียว
export const shopPrices = {
    CPE_Dollar: 2, 
    bigHikingBag: 400,
    baseballBatNails: 200,
    armyBoots: 300,
    camoJacket: 300,
    firemanJacket: 400,
    crashHelmet: 400,
    cigarette: 200,
    skill_rc_book: 400,
    petrolCan: 1000,
    petrolCanEmpty: 800
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
        `🔸 กรุณากดปุ่มด้านล่างเพื่อผูกบัญชี Discord เข้ากับชื่อตัวละครในเกม\n\n🔹 *หมายเหตุ: โปรดใช้ชื่อเดียวกับที่ใช้ในเซิร์ฟเวอร์ มีผลกับพิมพ์เล็กและพิมพ์ใหญ่\n\n🔸 Please click the button below to link your Discord account to your in-game character.
\n🔹 *Note: Your name must match your in-game username exactly (Case-Sensitive). \n\n 🎁 รับ welcome pack \n -Coin x 500 (to wallet)\n-BeefJerky x 2\n-Baloney x 1\n-OrangeJuice x 2`
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

export const setupGeneralBotShopChannel = async (message) => {
    const dollar_embed = createEmbed(
        "CPE_Dollar",
        "สกุลเงินในเกมที่ใช้สำหรับซื้อของจากร้านค้า\n\nCPE_Dollar is the in-game currency used for purchasing items from the shop.",
        'http://alldaygrow.tplinkdns.com:8080/CPE_Dollar_large.png'
    );
    const dollar_row = createRow(createButton('buy_CPE_Dollar', 'CPE_Dollar', ButtonStyle.Success, '🛍️'));
    await message.channel.send({ embeds: [dollar_embed], components: [dollar_row] });

    const cigarette_embed = createEmbed(
        "Cigarette","บุหรี่เป็นไอเทมที่สามารถใช้เพื่อเพิ่มความสุขชั่วคราว แต่มีผลข้างเคียงที่ลดสุขภาพ\n\nCigarettes are items that can be used to temporarily boost happiness but have a side effect of reducing health.",
        "https://pzwiki.net/w/images/c/c4/CigarettePack_Model.png"
    );
    const cigarette_row = createRow(createButton('buy_cigarette', `Cigarette : ${shopPrices.cigarette}`, ButtonStyle.Success, '🛍️'));
    await message.channel.send({ embeds: [cigarette_embed], components: [cigarette_row] });

    const skill_rc_book_embed = createEmbed(
        "Bound Journal",
        "หนังสือที่สามารถบันทึกทักษะและความรู้ต่างๆ ได้ คืนค่าประสบการณ์ 60%\n\nA book that can record various skills and knowledge. Restores 60% of experience.",
        "http://alldaygrow.tplinkdns.com:8080/bound_journal.png"
    );
    const skill_rc_book_row = createRow(createButton('buy_skill_rc_book', `Bound Journal : ${shopPrices.skill_rc_book}`, ButtonStyle.Success, '🛍️'));
    await message.channel.send({ embeds: [skill_rc_book_embed], components: [skill_rc_book_row] });
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
    // Hat_CrashHelmetFull
    const crash_helmet_embed = createEmbed(
        "Crash Helmet Full",
        "หมวกกันน็อคแบบเต็มรูปแบบที่ใช้สำหรับการขับรถ\n\nA full-face crash helmet is a protective headgear used while driving vehicles.",
        'http://alldaygrow.tplinkdns.com:8080/Crash_Helmet.png'
    );
    const crash_helmet_row = createRow(createButton('buy_crashHelmet', `Crash Helmet Full : ${shopPrices.crashHelmet}`, ButtonStyle.Success, '🛍️'));
    await message.channel.send({ embeds: [crash_helmet_embed], components: [crash_helmet_row] });

    // Jacket Camo
    const camo_jk_embed = createEmbed(
        "Jacket- Hunting Camo",
        "แจ็คเก็ตสีน้ำตาลที่ใช้สำหรับการล่าสัตว์ สุ่มสี\n\nA jacket - hunting camo is a clothing item. Random color.",
        "http://alldaygrow.tplinkdns.com:8080/unnamed.png"
    );
    const camo_jk_row = createRow(createButton('buy_camoJacket', `Jacket- Hunting Camo : ${shopPrices.camoJacket}`, ButtonStyle.Success, '🛍️'));
    await message.channel.send({ embeds: [camo_jk_embed], components: [camo_jk_row] });

    // Jacket Fireman
    const fireman_jk_embed = createEmbed(
        "Jacket- Fireman",
        "แจ็คเก็ตสีเหลืองที่ใช้สำหรับนักดับเพลิง\n\nA jacket - fireman is a clothing item.",
        "http://alldaygrow.tplinkdns.com:8080/FireFighter%20Jacket.png"
    );
    const fireman_jk_row = createRow(createButton('buy_firemanJacket', `Jacket- Fireman : ${shopPrices.firemanJacket}`, ButtonStyle.Success, '🛍️'));
    await message.channel.send({ embeds: [fireman_jk_embed], components: [fireman_jk_row] });
    
        // armyBoots
    const embed = createEmbed(
        "Army Boots",
        "รองเท้าทหารเป็นรองเท้าสีดำที่ทหารสวมใส่กันทั่วไป\n\nA military boots are black colored boots commonly worn by soldiers.",
        'https://pzwiki.net/w/images/3/3b/BootsArmy_Model.png'
    );
    const row = createRow(createButton('buy_armyBoot', `Army Boots : ${shopPrices.armyBoots}`, ButtonStyle.Success, '🛍️'));
    await message.channel.send({ embeds: [embed], components: [row] });
};

export const setupVehiclePartsBotShopChannel = async (message) => {
    const PTcan_embed = createEmbed(
        "Petrol Can",
        "ถังน้ำมันที่ใช้สำหรับเติมน้ำมันให้กับยานพาหนะ (มีน้ำมัน)\n\nA petrol can is a container used for refueling vehicles (with fuel).",
        "https://pzwiki.net/w/images/d/d2/GasCan_Model.png"
    );
    const PTcan_row = createRow(createButton('buy_petrolCan', `Petrol Can : ${shopPrices.petrolCan}`, ButtonStyle.Success, '🛍️'));
    await message.channel.send({ embeds: [PTcan_embed], components: [PTcan_row] });
    const PTcanEmpty_embed = createEmbed(
        "Petrol Can (Empty)",
        "ถังน้ำมันที่ใช้สำหรับเติมน้ำมันให้กับยานพาหนะ (เปล่า)\n\nA petrol can is a container used for refueling vehicles (empty).",
        "https://pzwiki.net/w/images/d/d2/GasCan_Model.png"
    );
    const PTcanEmpty_row = createRow(createButton('buy_petrolCanEmpty', `Petrol Can (Empty) : ${shopPrices.petrolCanEmpty}`, ButtonStyle.Success, '🛍️'));
    await message.channel.send({ embeds: [PTcanEmpty_embed], components: [PTcanEmpty_row] });
};

export async function setupRoleClaimChannel(message) {
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('claim_cpe_pjz_role')
            .setLabel('รับยศชาวแก๊ง CPE_PJZ')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🛡️')
    );

    await message.channel.send({
        content: '## 🛡️ ยืนยันตัวตนรับยศผู้เล่น\nกดปุ่มด้านล่างเพื่อรับยศ **CPE_PJZ** เพื่อเข้าถึงห้องพิเศษและสถานะผู้เล่นในเซิร์ฟเวอร์!',
        components: [row]
    });
}