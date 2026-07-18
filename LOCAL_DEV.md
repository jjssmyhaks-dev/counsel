# Counsel Platform — 本地运行指南

## 前置条件

- **Node.js** v22+ (已安装: `C:\Users\Ashif\AppData\Local\Microsoft\WindowsApps\node.exe`)
- **Python 3.12** (已安装: `C:\Users\Ashif\AppData\Local\Programs\Python\Python312\python.exe`)
- **Git Bash** 或 **Command Prompt**
- PostgreSQL 数据库 (Neon serverless, 已配置在 `packages\database\.env`)

## 项目结构

```
counsel-platform/
├── apps/
│   ├── web/          # Next.js 15 前端 (localhost:3000)
│   └── api/          # Express API 服务 (localhost:3001)
├── services/
│   └── ai/           # Python FastAPI AI 服务 (localhost:8000)
├── packages/
│   └── database/     # Prisma ORM + 数据库 Schema
├── extensions/
│   └── chrome/       # Chrome 扩展
└── scripts/          # 测试脚本 & 工具
```

## 🚀 启动所有服务 (在三个终端窗口中)

### 终端 1: AI 服务 (Python)

```cmd
cd C:\Users\Ashif\.openclaw-autoclaw\agents\counsel\workspace\counsel-platform\services\ai
venv\Scripts\python.exe -m uvicorn src.main:app --host 0.0.0.0 --port 8000
```

输出应显示:
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Application startup complete.
```

验证: 浏览器打开 <http://localhost:8000/health> → 应显示 `{"status":"ok",...}`

### 终端 2: API 服务 (Express)

```cmd
cd C:\Users\Ashif\.openclaw-autoclaw\agents\counsel\workspace\counsel-platform
node scripts/start-api.mjs
```

输出应显示:
```
🚀 Counsel API running at http://localhost:3001
   Health:    http://localhost:3001/api/health
   API Docs:  http://localhost:3001/api/docs
```

验证: <http://localhost:3001/api/docs> → Swagger UI 交互文档

### 终端 3: Web 前端 (Next.js)

```cmd
cd C:\Users\Ashif\.openclaw-autoclaw\agents\counsel\workspace\counsel-platform\apps\web
npx next dev -p 3000
```

输出应显示:
```
▲ Next.js 15.5.20
- Local:        http://localhost:3000
✓ Ready in 5s
```

验证: <http://localhost:3000> → 登录页面

---

## 🔑 测试账号

- **Email:** `admin@sterling.law`
- **Password:** `password`
- **角色:** James Sterling, Partner, Sterling & Associates

---

## 🛑 如何终止运行中的服务

### 方法 1: Ctrl+C (推荐)

在运行服务的终端窗口中按 **Ctrl + C** 即可停止该服务。

### 方法 2: 通过端口号强制终止

```cmd
:: 终止 AI 服务 (端口 8000)
for /f "tokens=5" %a in ('netstat -ano ^| findstr :8000 ^| findstr LISTENING') do taskkill /F /PID %a

:: 终止 API 服务 (端口 3001)
for /f "tokens=5" %a in ('netstat -ano ^| findstr :3001 ^| findstr LISTENING') do taskkill /F /PID %a

:: 终止 Web 服务 (端口 3000)
for /f "tokens=5" %a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do taskkill /F /PID %a

:: 一次终止所有三个服务
for /f "tokens=5" %a in ('netstat -ano ^| findstr :8000 ^| findstr LISTENING') do taskkill /F /PID %a
for /f "tokens=5" %a in ('netstat -ano ^| findstr :3001 ^| findstr LISTENING') do taskkill /F /PID %a
for /f "tokens=5" %a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do taskkill /F /PID %a
```

### 方法 3: 检查哪些端口正在监听

```cmd
netstat -ano | findstr "3000 3001 8000" | findstr LISTENING
```

---

## 🧪 运行测试

```cmd
cd C:\Users\Ashif\.openclaw-autoclaw\agents\counsel\workspace\counsel-platform

:: 独立 AI Agent 测试 (6 个)
node scripts/test-ai-agents.cjs

:: 全部 4 个 CrewAI 团队 + 完整流水线
node scripts/test-all-crews.cjs

:: 仅 Crew 1 (Document Intelligence)
node scripts/test-c1-only.cjs

:: Crew 2-4 + 完整流水线
node scripts/test-c2-c4-pipeline.cjs
```

---

## 📝 常见问题

### "端口已被占用"

```cmd
:: 查看哪个进程占用了端口
netstat -ano | findstr :3000
:: 最后一列是 PID，用以下命令终止
taskkill /F /PID <PID>
```

### "venv\Scripts\python.exe 不是可识别的命令"

说明 Python 虚拟环境未创建或路径不对。使用完整路径:
```cmd
C:\Users\Ashif\.openclaw-autoclaw\agents\counsel\workspace\counsel-platform\services\ai\venv\Scripts\python.exe -m uvicorn src.main:app --host 0.0.0.0 --port 8000
```

### "Redis version needs to be >=5.0"

本机 Redis 版本为 3.0，API 已自动降级为进程内轮询（in-process polling），功能不受影响。如需完整 BullMQ，升级 Redis 到 5.0+。

---

## 🔗 重要 URL

| 服务 | URL |
|------|-----|
| Web 前端 | <http://localhost:3000> |
| 登录页 | <http://localhost:3000/login> |
| Dashboard | <http://localhost:3000/dashboard> |
| API 文档 | <http://localhost:3001/api/docs> |
| API 健康检查 | <http://localhost:3001/api/health> |
| AI 健康检查 | <http://localhost:8000/health> |
| GitHub | <https://github.com/jjssmyhaks-dev/counsel> |
