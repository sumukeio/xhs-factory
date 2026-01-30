# Fly.io 部署后端（Python + Playwright）

目标：把 `backend/` 里的 FastAPI + Playwright 爬虫部署到 Fly.io，支持 **自动停机（min_machines_running=0）**，前端（Vercel）通过环境变量访问。

## 1）准备

- **安装 flyctl**：参考 Fly 官方安装方式（Windows/macOS/Linux）
- **登录**

```bash
fly auth login
```

## 2）创建/修改应用名（可选）

默认我在 `fly.toml` 里写的是：

- app = `xhs-factory-backend`

如果这个名字在 Fly 上已被占用，你需要换一个唯一名字（比如加上你的用户名/随机后缀），然后同步修改 `fly.toml` 的 `app` 字段。

## 3）部署

在项目根目录执行：

```bash
fly deploy
```

部署成功后，你会拿到一个 URL，形如：

- `https://xxxx.fly.dev`

## 4）验证后端是否可用

打开：

- `https://xxxx.fly.dev/docs`

如果能看到 FastAPI 的 Swagger 页面就 OK。

你也可以用 curl 验证（示例）：

```bash
curl -X POST "https://xxxx.fly.dev/api/browse_folder" -H "Content-Type: application/json" -d "{}"
```

## 5）配置前端（Vercel）

在 Vercel 项目环境变量里新增/修改：

- `NEXT_PUBLIC_BACKEND_URL = https://xxxx.fly.dev`

然后重新部署 Vercel（触发一次 redeploy）。

## 6）自动停机说明（省钱关键）

`fly.toml` 已配置：

- `auto_stop_machines = true`
- `min_machines_running = 0`

含义：没有请求时会自动停机；有请求时自动拉起（会有冷启动延迟）。

## 7）注意事项

- **Playwright 很吃资源**：免费额度下建议不要同时解析太多链接（我们后端并发也做了限制）。
- **ZIP下载功能**：✅ 已实现 - 所有下载都会自动打包成ZIP文件，直接下载到用户本地，不占用服务器存储
  - 单个笔记：点击预览弹窗的"下载"按钮，自动生成ZIP
  - 批量下载：一键下载多个笔记，每个笔记一个ZIP文件
  - ZIP内容：包含文本文件（标题+内容+标签+链接）和选中的图片
- **旧版"保存到文件夹"功能**：已移除UI，因为Fly.io的文件系统是临时的（重启可能丢数据）
  - 如果需要服务器端保存：可以接入对象存储（S3/R2）或挂载 Fly Volume（但可能不算"免费/用完停"）

## 8）更新部署

如果代码有更新，重新部署：

```bash
flyctl deploy
```

Fly.io 会自动：
- 构建新的 Docker 镜像
- 滚动更新现有机器（零停机）
- 保持配置不变

