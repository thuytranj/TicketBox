local redis = require("resty.redis")
local userId = ngx.ctx.userId

-- Only enforce rate limit for POST requests (creating bookings)
if ngx.req.get_method() ~= "POST" then
    return
end

-- If user is not authenticated (should not happen if jwt-validation passed, but as safety fallback)
if not userId then
    ngx.status = ngx.HTTP_UNAUTHORIZED
    ngx.header.content_type = "application/json; charset=utf-8"
    ngx.say('{"statusCode":401,"message":"Unauthorized"}')
    ngx.exit(ngx.HTTP_UNAUTHORIZED)
end

-- Rate limit configuration: 10 requests per 1 minute (60,000 ms)
local limit = 10
local window_ms = 60000
local key = "rate_limit:" .. userId .. ":" .. ngx.var.uri
local unique_id = tostring(ngx.now()) .. ":" .. tostring(math.random(100000, 999999))

-- Sliding window Redis Lua script
local sliding_window_script = [[
    local key = KEYS[1]
    local window = tonumber(ARGV[1])
    local max_req = tonumber(ARGV[2])
    local unique_id = ARGV[3]

    local redis_time = redis.call('time')
    local now = (tonumber(redis_time[1]) * 1000) + math.floor(tonumber(redis_time[2]) / 1000)

    redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
    local current = redis.call('ZCARD', key)

    if current >= max_req then
        return 0  -- BLOCKED
    end

    redis.call('ZADD', key, now, now .. ':' .. unique_id)
    redis.call('PEXPIRE', key, window)
    return 1  -- ALLOWED
]]

local red = redis:new()
red:set_timeouts(1000, 1000, 1000) -- 1 second timeout

local ok, err = red:connect("redis", 6379)
if not ok then
    ngx.log(ngx.ERR, "Redis connect failed: ", err, ". Fail-open strategy applied.")
    return -- Fail-open: allow request to proceed to NestJS
end

-- Run rate limit script
local res, err = red:eval(sliding_window_script, 1, key, window_ms, limit, unique_id)

-- Return connection to pool (10s idle timeout, pool size 100)
red:set_keepalive(10000, 100)

if not res then
    ngx.log(ngx.ERR, "Redis eval failed: ", err, ". Fail-open strategy applied.")
    return -- Fail-open
end

if res == 0 then
    ngx.status = ngx.HTTP_TOO_MANY_REQUESTS
    ngx.header.content_type = "application/json; charset=utf-8"
    ngx.header["X-RateLimit-Source"] = "gateway-user"
    ngx.say('{"statusCode":429,"message":"Too many requests. Please slow down."}')
    ngx.exit(ngx.HTTP_TOO_MANY_REQUESTS)
end
