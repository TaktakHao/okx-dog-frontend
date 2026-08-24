# =============================================================================
# Stage 1: 构建前端静态资源产物
# =============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# 安装依赖
COPY package.json package-lock.json* ./
RUN npm install

# 复制前端源码并执行编译
COPY . .
RUN npm run build

# =============================================================================
# Stage 2: 使用轻量 Nginx 提供服务与 API 反向代理
# =============================================================================
FROM nginx:alpine

# 复制 Nginx 配置文件
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 复制前端编译产物
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
