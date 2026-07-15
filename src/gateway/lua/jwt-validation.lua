local jwt = require("resty.jwt")
local jwt_secret = os.getenv("JWT_SECRET") or "4fjAifDnpexXnXf9vlmLUGV2hZTTwzBSFfYUzbGgNTw="

local auth_header = ngx.var.http_authorization
if not auth_header then
    ngx.status = ngx.HTTP_UNAUTHORIZED
    ngx.header.content_type = "application/json; charset=utf-8"
    ngx.say('{"statusCode":401,"message":"Unauthorized"}')
    ngx.exit(ngx.HTTP_UNAUTHORIZED)
end

local _, _, token = string.find(auth_header, "Bearer%s+(.+)")
if not token then
    ngx.status = ngx.HTTP_UNAUTHORIZED
    ngx.header.content_type = "application/json; charset=utf-8"
    ngx.say('{"statusCode":401,"message":"Invalid token format"}')
    ngx.exit(ngx.HTTP_UNAUTHORIZED)
end

local jwt_obj = jwt:verify(jwt_secret, token)
if not jwt_obj.verified then
    ngx.status = ngx.HTTP_UNAUTHORIZED
    ngx.header.content_type = "application/json; charset=utf-8"
    ngx.say('{"statusCode":401,"message":"' .. (jwt_obj.reason or "Invalid token") .. '"}')
    ngx.exit(ngx.HTTP_UNAUTHORIZED)
end

-- Export userId for use in subsequent Lua scripts or proxy headers
ngx.ctx.userId = jwt_obj.payload.userId
