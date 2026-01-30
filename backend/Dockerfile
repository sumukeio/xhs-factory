FROM python:3.11-slim

# Playwright Chromium 需要的系统依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 复制 requirements.txt（从 backend 目录）
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# 安装 Playwright 浏览器（Chromium）
RUN python -m playwright install chromium

# 复制整个 backend 目录的内容
COPY backend/ .

ENV PYTHONUNBUFFERED=1

# Fly.io 会注入 PORT 环境变量
EXPOSE 8080

CMD ["python", "main.py"]

