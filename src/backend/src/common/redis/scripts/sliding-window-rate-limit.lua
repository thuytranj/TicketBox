-- KEYS[1] = rate_limit:{user_id}:{endpoint}
-- ARGV[1] = window_size (milliseconds)
-- ARGV[2] = max_requests
-- ARGV[3] = unique_id

local key = KEYS[1]
local window = tonumber(ARGV[1])
local max_req = tonumber(ARGV[2])
local unique_id = ARGV[3]

-- 1. Lấy thời gian đồng nhất từ Redis Server (giây + microgiây)
local redis_time = redis.call('time')
local now = (tonumber(redis_time[1]) * 1000) + math.floor(tonumber(redis_time[2]) / 1000)

-- 2. Xóa các bản ghi cũ nằm ngoài cửa sổ thời gian trượt
redis.call('ZREMRANGEBYSCORE', key, 0, now - window)

-- 3. Đếm số request hiện tại trong cửa sổ trượt
local current = redis.call('ZCARD', key)

if current >= max_req then
    return 0  -- VƯỢT NGƯỠNG → chặn
end

-- 4. Ghi nhận request mới (score = timestamp, member = timestamp:unique_id)
redis.call('ZADD', key, now, now .. ':' .. unique_id)

-- 5. Đặt TTL tự động dọn dẹp key khi hết window
redis.call('PEXPIRE', key, window)

return 1  -- CHO PHÉP
