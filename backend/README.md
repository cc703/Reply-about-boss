# BOSS Chat Listener Backend

本地 FastAPI 服务，用于 BOSS Chat Listener 的 DeepSeek 回复草稿建议。

## Install

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

## Configure

启动服务后，点击浏览器工具栏中的 `BOSS Chat Listener` 图标，在扩展弹窗中保存 DeepSeek API Key。后端会把 Key 保存到 Windows 凭据管理器，只向扩展返回“已配置/未配置”状态。

后端不从 `.env`、环境变量或项目文件读取 API Key。不要把真实 Key 写入任何文件、截图、终端日志或提交到仓库。

## Run

```powershell
python -m uvicorn app.main:app --host 127.0.0.1 --port 8765
```

插件只会在你点击 `生成回复草稿` 后向本地服务发送清洗后的 `HR/我` 文本记录、语气和沟通目的；本地后端随后按需调用 DeepSeek。服务只绑定到 `127.0.0.1`，不会自动填充或发送 BOSS 消息。

## Test

```powershell
python -m unittest discover -s tests
python -m py_compile app\*.py
```
