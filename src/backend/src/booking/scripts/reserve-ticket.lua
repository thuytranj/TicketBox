--[[
  reserve-ticket.lua
  Atomic inventory check + per-user limit check + reservation

  KEYS:
    KEYS[1] = stock key          (e.g. "concert:{concertId}:ticket_type:{ticketTypeId}:stock")
    KEYS[2] = user_bought key    (e.g. "concert:{concertId}:user:{userId}:bought:{ticketTypeId}")

  ARGV:
    ARGV[1] = quantity to reserve (number)
    ARGV[2] = max_per_user limit  (number)

  Returns:
    0  => SUCCESS
   -1  => INSUFFICIENT_STOCK
   -2  => EXCEEDS_USER_LIMIT
]]

local stockKey    = KEYS[1]
local userBought  = KEYS[2]
local quantity    = tonumber(ARGV[1])
local maxPerUser  = tonumber(ARGV[2])

-- Get current stock (default 0 if not exist)
local currentStock = tonumber(redis.call('GET', stockKey) or '0')

-- Check stock availability
if currentStock < quantity then
  return -1  -- INSUFFICIENT_STOCK
end

-- Get current user's bought count (default 0)
local currentBought = tonumber(redis.call('GET', userBought) or '0')

-- Check per-user limit
if (currentBought + quantity) > maxPerUser then
  return -2  -- EXCEEDS_USER_LIMIT
end

-- All checks passed: deduct stock and increment user's bought count
redis.call('DECRBY', stockKey, quantity)
redis.call('INCRBY', userBought, quantity)

return 0  -- SUCCESS
