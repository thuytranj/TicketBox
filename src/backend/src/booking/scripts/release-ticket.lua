--[[
  release-ticket.lua
  Atomically release (rollback) a ticket reservation on Redis.
  Used by DLX consumer and Cronjob when an order expires.

  KEYS:
    KEYS[1] = stock key          (e.g. "concert:{concertId}:ticket_type:{ticketTypeId}:stock")
    KEYS[2] = user_bought key    (e.g. "concert:{concertId}:user:{userId}:bought:{ticketTypeId}")

  ARGV:
    ARGV[1] = quantity to release (number)

  Returns:
    0  => SUCCESS
]]

local stockKey   = KEYS[1]
local userBought = KEYS[2]
local quantity   = tonumber(ARGV[1])

-- Restore stock
redis.call('INCRBY', stockKey, quantity)

-- Decrease user's bought count (floor to 0)
local currentBought = tonumber(redis.call('GET', userBought) or '0')
local newBought = math.max(0, currentBought - quantity)
redis.call('SET', userBought, newBought)

return 0  -- SUCCESS
