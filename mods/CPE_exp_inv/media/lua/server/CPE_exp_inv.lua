local exportCooldowns = {}
local pendingTransactions = {} 
local confirmFilePath = "confirm_queue.txt" -- เปลี่ยนมาใช้ชื่อไฟล์ตรงๆ (จะอยู่ในโฟลเดอร์ Lua ของตัวเกม)

-- ฟังก์ชันเสริมสำหรับหาตัวละครจากชื่อ
local function getPlayerByUsername(username)
    local players = getOnlinePlayers()
    for i=0, players:size()-1 do
        local player = players:get(i)
        if player:getUsername() == username then
            return player
        end
    end
    return nil
end

local function checkConfirmationAndRefund()
    local currentTime = getTimestampMs()

    -- 1. อ่านไฟล์ยืนยันจาก Bot
    -- ใช้ getFileReader แบบค้นหาใน Sandbox ของ Zomboid
    local fileReader = getFileReader(confirmFilePath, false)
    
    if fileReader then
        local line = fileReader:readLine()
        local foundInFile = {} -- เก็บ TXID ทั้งหมดที่เจอในไฟล์รอบนี้
        
        while line ~= nil do
            -- ลบช่องว่างและตัวอักษรพิเศษ
            local txid = line:gsub("%s+", "") 
            if txid ~= "" then
                foundInFile[txid] = true
            end
            line = fileReader:readLine()
        end
        fileReader:close()
        
        -- ตรวจสอบว่า TXID ที่เจอ ตรงกับรายการที่รออยู่ไหม
        local confirmedAny = false
        for txid, _ in pairs(foundInFile) do
            if pendingTransactions[txid] then
                pendingTransactions[txid] = nil -- ยืนยันสำเร็จ!
                confirmedAny = true
                -- print("DEBUG: Confirmed TXID: " .. txid) -- คุณจะเห็นข้อความนี้ใน Console (F11)
            end
        end
        
        -- ล้างไฟล์ "เฉพาะ" เมื่อมีการยืนยันสำเร็จแล้วเท่านั้น
        if confirmedAny then
            local fileWriter = getFileWriter(confirmFilePath, false, false)
            if fileWriter then fileWriter:close() end
        end
    end

    -- 2. วนลูปเช็ครายการที่ค้าง (Refund)
    -- ใช้การ Copy ตารางเพื่อความปลอดภัยขณะลบข้อมูล (Prevent pairs error)
    local toProcess = {}
    for txid, _ in pairs(pendingTransactions) do
        table.insert(toProcess, txid)
    end

    for _, txid in ipairs(toProcess) do
        local data = pendingTransactions[txid]
        if data and data.expireTime and currentTime > data.expireTime then
            local player = getPlayerByUsername(data.username)
            if player then
                local inv = player:getInventory()
                if inv then
                    if data.dollar > 0 then
                        for i = 1, data.dollar do inv:AddItem("Base.CPE_Dollar") end
                    end
                    if data.money > 0 then
                        for i = 1, data.money do inv:AddItem("Base.Money") end
                    end
                    player:Say("System Error: Bot Confirmation Timeout!")
                end
            end
            pendingTransactions[txid] = nil
        end
    end
end

-- ฟังก์ชันหลักตอนกดคลิกขวา
local function exportItemsLogic(playerObj)
    if not playerObj then return end
    
    local username = playerObj:getUsername()
    local currentTime = getTimestampMs()
    
    if exportCooldowns[username] and (currentTime - exportCooldowns[username] < 30000) then
        playerObj:Say("Please wait... " .. math.ceil((30000 - (currentTime - exportCooldowns[username])) / 1000) .. " seconds") return
    end

    local inventory = playerObj:getInventory()
    local items = inventory:getItems()
    local dollarCount = 0
    local moneyCount = 0
    local itemsToRemove = {}
    
    for i = 0, items:size() - 1 do 
        local item = items:get(i)
        if item then
            local type = item:getFullType()
            if type == "Base.CPE_Dollar" then
                dollarCount = dollarCount + 1
                table.insert(itemsToRemove, item)
            elseif type == "Base.Money" then
                moneyCount = moneyCount + 1
                table.insert(itemsToRemove, item)
            end
        end
    end
    
    if dollarCount > 0 or moneyCount > 0 then
        local txid = tostring(currentTime) .. "_" .. username
        
        for _, item in ipairs(itemsToRemove) do
            inventory:Remove(item)
        end

        -- ปรับเวลาเป็น 20 วินาที (20000) เพื่อให้ระบบมีเวลาทำงาน
        pendingTransactions[txid] = {
            username = username,
            dollar = dollarCount,
            money = moneyCount,
            expireTime = currentTime + 5000 -- 5 วินาที (5000) เพื่อให้ระบบมีเวลาทำงานและยืนยันจาก Bot 
        }

        writeLog("ITEM_DATA_EXPORT", "[TXID]:" .. txid .. " [PLAYER]:" .. username .. " [CPE_DOLLAR]:" .. tostring(dollarCount) .. " [MONEY]:" .. tostring(moneyCount))
        
        exportCooldowns[username] = currentTime

        local totalCoins = (dollarCount * 2) + moneyCount
        local coinStr = (totalCoins > 1) and "Coins" or "Coin"

        if dollarCount == 0 then
            playerObj:Say("Exporting " .. moneyCount .. " Money. Received " .. totalCoins .. " " .. coinStr)
        elseif moneyCount == 0 then
            playerObj:Say("Exporting " .. dollarCount .. " CPE Dollars. Received " .. totalCoins .. " " .. coinStr)
        else
            playerObj:Say("Exporting " .. dollarCount .. " CPE Dollars and " .. moneyCount .. " Money. Received " .. totalCoins .. " " .. coinStr)
        end
    else
        playerObj:Say("No items found!")
    end
end

Events.OnFillWorldObjectContextMenu.Add(function(player, context, worldobjects, test)
    local p = getSpecificPlayer(player)
    if p then
        context:addOption("Export Currency to Wallet", p, exportItemsLogic)
    end
end)

Events.OnTick.Add(function(ticks)
    if ticks % 120 == 0 then -- เช็คทุกๆ ~2 วินาทีเพื่อไม่ให้หนักเครื่อง
        checkConfirmationAndRefund() 
    end
end)
-- *************************--************  --- ************************************** --

local tickCounter = 0

local function checkDeleteQueue()
    tickCounter = tickCounter + 1
    -- ตรวจสอบไฟล์ทุกๆ ประมาณ 3 วินาที (180 ticks สมมติที่ 60FPS)
    if tickCounter < 180 then return end
    tickCounter = 0

    local fileReader = getFileReader("delete_items_queue.txt", true)
    if not fileReader then return end

    local line = fileReader:readLine()
    local commands = {}
    local hasData = false

    while line ~= nil do
        if line ~= "" then
            table.insert(commands, line)
            hasData = true
        end
        line = fileReader:readLine()
    end
    fileReader:close()

    if hasData then
        local players = getOnlinePlayers()
        
        for _, cmd in ipairs(commands) do
            -- 📦 เปลี่ยนวิธีแยกข้อความให้รองรับ "ชื่อ,ไอเทม,จำนวน"
            local parts = {}
            for part in string.gmatch(cmd, "([^,]+)") do
                table.insert(parts, part)
            end
            
            local targetUser = parts[1]
            local targetItem = parts[2]
            local quantityStr = parts[3]
            
            -- แปลงจำนวนเป็นตัวเลข ถ้าไม่ได้ใส่มาให้ใช้ค่าเริ่มต้นคือ 1
            local quantity = tonumber(quantityStr) or 1 
            
            if targetUser and targetItem then
                for i = 0, players:size() - 1 do
                    local p = players:get(i)
                    if p:getUsername() == targetUser then
                        local inv = p:getInventory()
                        local removedCount = 0
                        
                        -- 🔄 วนลูปหาและลบไอเทมตามจำนวนที่ส่งมา
                        for q = 1, quantity do
                            local itemToRemove = inv:FindAndReturn(targetItem)
                            
                            if itemToRemove then
                                inv:Remove(itemToRemove)
                                removedCount = removedCount + 1
                            else
                                -- ถ้าไอเทมในกระเป๋าหมดก่อนที่จะลบครบตามจำนวน ให้หยุดลูปทันที
                                break 
                            end
                        end
                        
                        -- สรุปผลการลบ
                        if removedCount > 0 then
                            print("NODE_CMD: ลบ " .. targetItem .. " จำนวน " .. removedCount .. " ชิ้น ออกจากกระเป๋า " .. targetUser .. " แล้ว")
                        else
                            print("NODE_CMD: ไม่พบ " .. targetItem .. " ในกระเป๋าของ " .. targetUser)
                        end
                        
                        break -- เจอตัวผู้เล่นแล้ว หยุดค้นหาผู้เล่นคนอื่นต่อ
                    end
                end
            end
        end

        -- ล้างข้อมูลในไฟล์ทิ้งให้เป็นไฟล์เปล่าๆ
        local fileWriter = getFileWriter("delete_items_queue.txt", true, false)
        fileWriter:write("")
        fileWriter:close()
    end
end

Events.OnTick.Add(checkDeleteQueue)

-- ฟังก์ชันสำหรับเพิ่มเงินให้ซอมบี้ตอนตาย
local function DropCPEDollarFromZombie(zombie)
    -- 1. กำหนดโอกาสดรอป (ตั้งไว้ที่ 25%)
    local dropChance = 45 -- เปอร์เซ็นต์โอกาสดรอป (เช่น 40 หมายถึง 40% โอกาสดรอป)
    local rand = ZombRand(1, 101)
    -- ZombRand(1, 101) จะสุ่มเลขตั้งแต่ 1 ถึง 100
    if rand <= dropChance and rand <= 10 then
        
        -- 2. สุ่มจำนวนเงินที่จะดรอป (เช่น ดรอปทีละ 1 ถึง 5 ใบ)
        -- ZombRand(1, 6) จะสุ่มเลข 1, 2, 3, 4, 5
        local amount = ZombRand(11, 16) 
        
        -- ดึงข้อมูลกระเป๋าของซอมบี้ตัวที่ตาย
        local inv = zombie:getInventory()
        
        -- 3. ยัดเงินใส่กระเป๋าซอมบี้ตามจำนวนที่สุ่มได้
        for i = 1, amount do
            inv:AddItem("Base.CPE_Dollar")
        end
        
        -- (Option) ใส่ Print ไว้เช็คใน Log ฝั่ง Server ได้ว่าดรอปสำเร็จไหม
        -- print("💰 ซอมบี้ดรอปเงิน CPE Dollar จำนวน " .. tostring(amount) .. " ใบ!")
    elseif rand <= dropChance and rand > 10 and rand <= 25 then
        local amount = ZombRand(5, 11) 
        local inv = zombie:getInventory()
        for i = 1, amount do
            inv:AddItem("Base.CPE_Dollar")
        end
    elseif rand <= dropChance and rand > 25 then
        local amount = ZombRand(1, 6) 
        local inv = zombie:getInventory()
        for i = 1, amount do
            inv:AddItem("Base.CPE_Dollar")
        end
    end
    
    -- ZombRand(1, 101) จะสุ่มเลขตั้งแต่ 1 ถึง 100
    -- if ZombRand(1, 101) <= dropChance then
        
    --     -- 2. สุ่มจำนวนเงินที่จะดรอป (เช่น ดรอปทีละ 1 ถึง 5 ใบ)
    --     -- ZombRand(1, 6) จะสุ่มเลข 1, 2, 3, 4, 5
    --     local amount = ZombRand(1, 11) 
        
    --     -- ดึงข้อมูลกระเป๋าของซอมบี้ตัวที่ตาย
    --     local inv = zombie:getInventory()
        
    --     -- 3. ยัดเงินใส่กระเป๋าซอมบี้ตามจำนวนที่สุ่มได้
    --     for i = 1, amount do
    --         inv:AddItem("Base.CPE_Dollar")
    --     end
        
    --     -- (Option) ใส่ Print ไว้เช็คใน Log ฝั่ง Server ได้ว่าดรอปสำเร็จไหม
    --     -- print("💰 ซอมบี้ดรอปเงิน CPE Dollar จำนวน " .. tostring(amount) .. " ใบ!")
    -- end
end

Events.OnZombieDead.Add(DropCPEDollarFromZombie)
