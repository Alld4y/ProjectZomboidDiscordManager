local exportCooldowns = {}
local pendingTransactions = {} 
local confirmFilePath = "confirm_queue.txt"

-- ฟังก์ชันสำหรับตัดช่องว่างหน้า/หลัง (เพื่อรองรับชื่อเว้นวรรค)
local function trim(s)
    return s:match("^%s*(.-)%s*$")
end

local function getPlayerByUsername(username)
    local players = getOnlinePlayers()
    for i=0, players:size()-1 do
        local player = players:get(i)
        if player:getUsername() == username then return player end
    end
    return nil
end

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

        pendingTransactions[txid] = {
            dollar = dollarCount, 
            money = moneyCount,
            username = username, -- เก็บชื่อไว้หาตัวผู้เล่นตอน confirm
            expireTime = currentTime + 20000 
        }

        sendClientCommand(playerObj, 'CPE_Wallet', 'WriteExportLog', {
            txid = txid, dollar = dollarCount, money = moneyCount
        })
        
        exportCooldowns[username] = currentTime
        -- คงข้อความเดิมไว้ตามที่ขอครับ
        if dollarCount == 0 and moneyCount > 0 then
            playerObj:Say("Exported " .. moneyCount .. " Money! Wait for confirmation." )
        elseif dollarCount > 0 and moneyCount == 0 then
            playerObj:Say("Exported " .. dollarCount .. " CPE Dollars! Wait for confirmation." )
        elseif dollarCount > 0 and moneyCount > 0 then
            playerObj:Say("Exported " .. dollarCount .. " CPE Dollars and " .. moneyCount .. " Money! Wait for confirmation." )
        elseif dollarCount == 0 and moneyCount == 0 then
            playerObj:Say("No items found!")
        end
    end
end

local function OnServerCommand(module, command, args)
    if module == 'CPE_Wallet' and command == 'ConfirmSuccess' then
        local data = pendingTransactions[args.txid]
        
        if data then
            -- แก้ไข: หาผู้เล่นตัวจริงแทน getSpecificPlayer(0) เพื่อให้พูดถูกคน
            local p = getPlayerByUsername(data.username)
            if p then
                local totalCoins = (data.money * 1) + (data.dollar * 2)
                p:Say("Received " .. totalCoins .. " Coins ") -- ข้อความเดิม
            end
            
            pendingTransactions[args.txid] = nil
        end
    end
end

local function checkServerConfirmation()
    if isClient() then return end
    local fileReader = getFileReader(confirmFilePath, false)
    if not fileReader then return end

    local line = fileReader:readLine()
    local confirmedTXIDs = {}
    while line ~= nil do
        -- แก้ไข: ใช้ trim แทน gsub เพื่อให้ "Naem kai" ไม่กลายเป็น "Naemkai"
        local txid = trim(line)
        if txid ~= "" then table.insert(confirmedTXIDs, txid) end
        line = fileReader:readLine()
    end
    fileReader:close()

    if #confirmedTXIDs > 0 then
        for _, txid in ipairs(confirmedTXIDs) do
            sendServerCommand('CPE_Wallet', 'ConfirmSuccess', {txid = txid})
        end
        local fileWriter = getFileWriter(confirmFilePath, false, false)
        if fileWriter then fileWriter:close() end
    end
end

local function OnClientCommand(module, command, player, args)
    if module == 'CPE_Wallet' and command == 'WriteExportLog' then
        writeLog("ITEM_DATA_EXPORT", "[TXID]:" .. tostring(args.txid) .. " [PLAYER]:" .. player:getUsername() .. " [CPE_DOLLAR]:" .. tostring(args.dollar) .. " [MONEY]:" .. tostring(args.money))
        print("[CPE SERVER] Log Written for: " .. player:getUsername())
    end
end

Events.OnFillWorldObjectContextMenu.Add(function(player, context, worldobjects, test)
    local p = getSpecificPlayer(player)
    if p then context:addOption("Export Currency to Wallet", p, exportItemsLogic) end
end)

if isClient() then
    Events.OnServerCommand.Add(OnServerCommand)
    Events.OnTick.Add(function(ticks)
        if ticks % 120 == 0 then
            local currentTime = getTimestampMs()
            for txid, data in pairs(pendingTransactions) do
                if currentTime > data.expireTime then
                    -- แก้ไข: ส่งคืนไอเทมให้ผู้เล่นตัวจริง
                    local p = getPlayerByUsername(data.username)
                    if p then
                        local inv = p:getInventory()
                        for i=1, data.dollar do inv:AddItem("Base.CPE_Dollar") end
                        for i=1, data.money do inv:AddItem("Base.Money") end
                        p:Say("Bot Timeout! Items refunded.") -- ข้อความเดิม
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

-- ส่วน Delete Queue และ Drop Zombie คงเดิมตามที่คุณเขียนมาครับ
local tickCounter = 0
local function checkDeleteQueue()
    tickCounter = tickCounter + 1
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
            local parts = {}
            for part in string.gmatch(cmd, "([^,]+)") do
                table.insert(parts, trim(part)) -- เพิ่ม trim ตรงนี้เพื่อความปลอดภัย
            end
            local targetUser = parts[1]
            local targetItem = parts[2]
            local quantityStr = parts[3]
            local quantity = tonumber(quantityStr) or 1 
            if targetUser and targetItem then
                local p = getPlayerByUsername(targetUser)
                if p then
                    local inv = p:getInventory()
                    local removedCount = 0
                    for q = 1, quantity do
                        local itemToRemove = inv:FindAndReturn(targetItem)
                        if itemToRemove then
                            inv:Remove(itemToRemove)
                            removedCount = removedCount + 1
                        else break end
                    end
                end
            end
        end
        local fileWriter = getFileWriter("delete_items_queue.txt", true, false)
        fileWriter:write("")
        fileWriter:close()
    end
end
Events.OnTick.Add(checkDeleteQueue)

local function DropCPEDollarFromZombie(zombie)
    local dropChance = 35
    local rand = ZombRand(1, 101)
    if rand <= dropChance then
        local amount = 1
        if rand <= 5 then amount = ZombRand(11, 16)
        elseif rand <= 15 then amount = ZombRand(5, 11)
        else amount = ZombRand(1, 6) end
        local inv = zombie:getInventory()
        for i = 1, amount do inv:AddItem("Base.CPE_Dollar") end
    end
end
Events.OnZombieDead.Add(DropCPEDollarFromZombie)