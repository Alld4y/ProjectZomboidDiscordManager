require "Items/ProceduralDistributions"

local function ReplaceMoneyEverywhere()
    -- 1. เปลี่ยนในตารางสุ่มของ (Loot Table) ทั่วโลก
    for _, v in pairs(ProceduralDistributions.list) do
        if v.items then
            for i = 1, #v.items, 2 do
                if v.items[i] == "Money" or v.items[i] == "Cash" or v.items[i] == "Base.Money" then
                    v.items[i] = "CPE_Dollar"
                end
            end
        end
    end
end

-- สั่งให้เปลี่ยนทันทีหลังจากเกมโหลดมอดทุกตัวเสร็จ
Events.OnPostDistributionMerge.Add(ReplaceMoneyEverywhere)

-- 2. ดักจังหวะคนเปิดตู้ (ป้องกันมอดอื่นเสกแทรก)
Events.OnFillContainer.Add(function(roomName, containerType, container)
    if not container then return end
    if container:contains("Base.Money") then
        local count = container:getItemCount("Base.Money")
        container:RemoveAllTypeRecurse("Base.Money")
        container:AddItems("Base.CPE_Dollar", count)
    end
end)

-- 3. ดักจังหวะซอมบี้ตาย (ถ้ามีเงินในตัว ให้เปลี่ยนทันที)
Events.OnZombieDead.Add(function(zombie)
    local inv = zombie:getInventory()
    if inv:contains("Base.Money") then
        local count = inv:getItemCount("Base.Money")
        inv:RemoveAllTypeRecurse("Base.Money")
        inv:AddItems("Base.CPE_Dollar", count)
    end
end)