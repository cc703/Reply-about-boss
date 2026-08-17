# BOSS Chat Listener

本项目当前阶段用于在 BOSS 直聘网页聊天页中识别当前可见会话记录，并可通过本地服务生成回复草稿。

## 当前版本（v0.12.0）

- Manifest V3 浏览器插件
- 监听页面 DOM 变化
- 识别当前会话中的 HR、我、系统、未知记录
- 过滤 `发简历`、职位卡片、PK 分析卡等控件内容
- 在页面右侧显示小面板
- 可拖动面板标题栏调整位置，面板会保持在当前视口范围内
- 点击浏览器工具栏图标后，在扩展弹窗中配置 DeepSeek API Key
- API Key 持久化到 Windows 凭据管理器，不写入扩展存储或网页
- 手动点击 `生成回复草稿` 后请求本地后端
- 可选择 `自然`、`简洁直接`、`稳妥留余地`、`积极一些`，或输入一次性的自定义语气
- 可选择 `自动判断`、`继续了解`、`婉拒岗位`、`礼貌结束`，区分沟通目的和表达语气
- 回复默认采用真实求职者聊天风格，避免正式邮件和客服式套话
- DeepSeek 调用只发生在本地后端，且仅在手动点击生成草稿后发生
- 不自动填输入框、不自动回复、不自动发送

## 本地使用

1. 打开 Chrome 或 Edge 的扩展管理页面。
2. 开启开发者模式。
3. 选择“加载已解压的扩展程序”。
4. 选择本项目的 `extension/` 目录。
5. 打开 BOSS 网页聊天页，右侧会显示监听面板。

## 回复草稿后端

安装并启动本地 FastAPI 服务：

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8765
```

启动后，点击 Chrome 工具栏中的 `BOSS Chat Listener` 图标，在弹窗中输入 API Key 并点击“保存”。Key 会由本地后端写入 Windows 凭据管理器，扩展只显示“已配置/未配置”状态，不会保存或显示 Key。后端不会从环境变量或项目文件读取 API Key。

插件只会在你手动点击 `生成回复草稿` 后，把清洗后的 `HR/我` 文本记录、当前语气和沟通目的发送给本地服务；自定义语气不持久化。随后仅由本地后端把生成所需上下文发送给 DeepSeek。Key 不会进入 BOSS 页面、聊天记录、剪贴板或请求正文。

不要把 API Key 写入代码、`.env`、截图、终端日志或提交到 GitHub。需要更换或清除 Key 时，只在扩展弹窗中操作。

## 隐私与安全边界

- 插件只在 BOSS 页面运行，且只读取当前可见聊天区域。
- 后端只监听 `127.0.0.1:8765`，不提供公网服务。
- 不读取 Cookie、不操作登录、不调用 BOSS 非公开接口。
- 不自动填充聊天输入框，也不会自动发送任何消息。
- 项目忽略规则排除本地凭据、虚拟环境、代理状态、截图、简历和聊天导出内容。

## 发布状态

项目采用 MIT License。GitHub 目标仓库为 `cc703/Reply-about-boss`；发布前会复核实际 Git 跟踪文件，确保不包含 API Key、虚拟环境、本地运行状态、截图、简历或聊天导出内容。

## 本地验证

```powershell
npm.cmd test
npm.cmd run check
python -m unittest discover -s backend/tests
python -c "import py_compile, pathlib; [py_compile.compile(str(p), doraise=True) for p in pathlib.Path('backend/app').glob('*.py')]; print('backend py_compile ok')"
```

也可以直接打开：

```text
extension/test-fixtures/boss-chat-transcript-sample.html
```

这个页面用于本地观察面板是否能识别当前会话记录。
