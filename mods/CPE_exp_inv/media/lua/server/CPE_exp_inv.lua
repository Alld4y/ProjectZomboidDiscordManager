local exportCooldowns = {}
local pendingTransactions = {} 
local confirmFilePath = "confirm_queue.txt"

-- ฟังก์ชันหาตัวละคร (รันได้ทั้ง Client และ Server)
local function getPlayerByUsername(username)
    local players = getOnlinePlayers()
    for i=0, players:size()-1 do
        local player = players:get(i)
        if player:getUsername() == username then return player end
    end
    return nil
end

-- ==========================================
-- [1] ฝั่ง CLIENT: จัดการ UI และการส่งข้อมูล
-- ==========================================
local function exportItemsLogic(playerObj)
    if not playerObj or not isClient() then return end
    
    local username = playerObj:getUsername()
    local currentTime = getTimestampMs()
    
    if exportCooldowns[username] and (currentTime - exportCooldowns[username] < 30000) then
        playerObj:Say("Wait... " .. math.ceil((30000 - (currentTime - exportCooldowns[username])) / 1000) .. "s") return
    end

    local inventory = playerObj:getInventory()
    local items = inventory:getItems()
    local dollarCount, moneyCount = 0, 0
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
        for _, item in ipairs(itemsToRemove) do inventory:Remove(item) end

        -- บันทึกรายการค้าง (Client จำไว้เพื่อรอ Refund ถ้า Server เงียบไป)
        pendingTransactions[txid] = {
            dollar = dollarCount, money = moneyCount,
            expireTime = currentTime + 20000 -- ให้เวลาบอท 20 วินาที
        }

        -- ส่งคำสั่งไป Server
        sendClientCommand(playerObj, 'CPE_Wallet', 'WriteExportLog', {
            txid = txid, dollar = dollarCount, money = moneyCount
        })
        
        exportCooldowns[username] = currentTime
        playerObj:Say("Processing... Waiting for Bot.")
    else
        playerObj:Say("No items found!")
    end
end

-- ดักฟังคำยืนยันจาก Server
local function OnServerCommand(module, command, args)
    if module == 'CPE_Wallet' and command == 'ConfirmSuccess' then
        if pendingTransactions[args.txid] then
            pendingTransactions[args.txid] = nil -- ลบรายการค้างทิ้ง (เงินเข้าแล้ว!)
            -- print("✅ Transaction Confirmed by Server: " .. args.txid)
        end
    end
end

-- ==========================================
-- [2] ฝั่ง SERVER: จัดการไฟล์และส่งสัญญาณยืนยัน
-- ==========================================
local function checkServerConfirmation()
    if isClient() then return end
    local fileReader = getFileReader(confirmFilePath, false)
    if not fileReader then return end

    local line = fileReader:readLine()
    local confirmedTXIDs = {}
    while line ~= nil do
        local txid = line:gsub("%s+", "")
        if txid ~= "" then table.insert(confirmedTXIDs, txid) end
        line = fileReader:readLine()
    end
    fileReader:close()

    if #confirmedTXIDs > 0 then
        for _, txid in ipairs(confirmedTXIDs) do
            -- ส่งคำสั่งกลับไปหา Client ทุกคนที่มี TXID นี้ (ปกติจะมีแค่คนเดียว)
            sendServerCommand('CPE_Wallet', 'ConfirmSuccess', {txid = txid})
        end
        -- ล้างไฟล์ยืนยัน
        local fileWriter = getFileWriter(confirmFilePath, false, false)
        if fileWriter then fileWriter:close() end
    end
end

-- รับคำสั่งจาก Client เพื่อเขียน Log
local function OnClientCommand(module, command, player, args)
    if module == 'CPE_Wallet' and command == 'WriteExportLog' then
        writeLog("ITEM_DATA_EXPORT", "[TXID]:" .. tostring(args.txid) .. " [PLAYER]:" .. player:getUsername() .. " [CPE_DOLLAR]:" .. tostring(args.dollar) .. " [MONEY]:" .. tostring(args.money))
        print("[CPE SERVER] Log Written for: " .. player:getUsername())
    end
end

-- ==========================================
-- [3] EVENTS REGISTRATION
-- ==========================================
Events.OnFillWorldObjectContextMenu.Add(function(player, context, worldobjects, test)
    local p = getSpecificPlayer(player)
    if p then context:addOption("Export Currency to Wallet", p, exportItemsLogic) end
end)

if isClient() then
    Events.OnServerCommand.Add(OnServerCommand)
    -- ระบบ Refund ของ Client (ถ้าผ่าน 20 วิแล้ว Server ไม่ส่ง Confirm มา)
    Events.OnTick.Add(function(ticks)
        if ticks % 120 == 0 then
            local currentTime = getTimestampMs()
            for txid, data in pairs(pendingTransactions) do
                if currentTime > data.expireTime then
                    local p = getSpecificPlayer(0) -- Client ตัวเอง
                    if p then
                        local inv = p:getInventory()
                        for i=1, data.dollar do inv:AddItem("Base.CPE_Dollar") end
                        for i=1, data.money do inv:AddItem("Base.Money") end
                        p:Say("Bot Timeout! Items refunded.")
                    end
                    pendingTransactions[txid] = nil
                end
            end
        end
    end)
else
    Events.OnClientCommand.Add(OnClientCommand)
    Events.OnTick.Add(function(ticks)
        if ticks % 120 == 0 then checkServerConfirmation() end
    end)
end
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
