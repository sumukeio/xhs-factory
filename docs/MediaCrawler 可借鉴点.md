# MediaCrawler 项目可借鉴点

本文档基于对 `D:\j\OpenProject\MediaCloner\MediaCrawler` 的阅读，提炼出对 xhs-factory 有参考价值的设计与实现，便于后续选型与演进。

---

## 只专注「爬虫与下载」时可借鉴的功能（摘要）

若 xhs-factory 只做「解析笔记 + 下载图片/视频」，下面这些可直接借鉴，按优先级和实现成本排列。

| 功能 | MediaCrawler 做法 | 在 xhs-factory 的落地建议 | 优先级 |
|------|-------------------|---------------------------|--------|
| **抓取间隔** | 每条笔记详情拉取后 `random.uniform(7, 12)` 秒再继续 | 批量解析时每条之间 `asyncio.sleep(random.uniform(2, 5))`，减轻限流 | 高 |
| **单条失败重试** | API 请求用 tenacity 重试 3 次；详情拉不到时再试 `get_note_by_id_from_html` | 单条笔记抓取失败时重试 1～2 次（间隔 1～2 秒），避免偶发空数据 | 高 |
| **限流/错误类型** | 300012→IPBlockError，471/461→验证码，单独异常类 | 已做 300013；可再定义 `RateLimitError`，前端/接口层区分「稍后重试」与「链接无效」 | 中 |
| **解析与抓取分离** | extractor 只做「从 HTML/state 抽数据」，client 负责请求 | scraper 拆成：取 page → 取 `__INITIAL_STATE__` → 解析 note 的两个函数，便于单测和换数据源 | 中 |
| **图片下载间隔** | 每张图下载后 `await asyncio.sleep(random.random())` | 批量下载图片时每张之间加 0.2～0.5 秒随机延迟，降低被限流概率 | 中 |
| **视频下载** | `get_note_media(url)` 拉二进制，store 按 note_id 落盘为 mp4 | 若需支持视频笔记，可复用其「从 note 取 video_url → httpx 拉流 → 保存」流程 | 低（按需） |
| **否词过滤** | 解析后 `_should_exclude_note(note_detail)`，含否词则跳过不存 | 若需「排除含某关键词的笔记」，解析完成后过滤再加入结果列表 | 低（按需） |
| **批次目录** | 每次任务建 `run_yyyyMMdd_HHmmss`，笔记按「标题_noteId」子目录存 | 当前是 ZIP 下载；若增加「按任务导出到本地文件夹」，可参考其目录命名与结构 | 低（按需） |

**建议优先做**：抓取间隔 + 单条重试 + 图片下载间隔。其余按需求再加。

### 爬虫与下载相关实现要点（MediaCrawler 侧）

- **解析**：`extractor.extract_note_detail_from_html(note_id, html)` 用正则取出 `window.__INITIAL_STATE__=({...})`，再 `humps.decamelize` 转成 snake_case，取 `note.note_detail_map[note_id].note`。xhs-factory 当前是直接 `page.evaluate` 取 `__INITIAL_STATE__`，再手写键名；若小红书改字段名，可参考其「正则 + 一次解析」便于兼容多版本。
- **详情拉取策略**：先调接口 `get_note_by_id`，失败再 `get_note_by_id_from_html`（打开笔记页取 HTML 再 extract）。xhs-factory 目前只有「打开页面取 state」一种方式，足够用；若以后要减打开页面次数，可考虑「接口优先、页面兜底」。
- **图片/视频下载**：`get_note_media(url)` 用 httpx 拉二进制，带 Referer/User-Agent；每张图/每个视频下载后 `asyncio.sleep(random.random())`。存储按 `note_id` 建子目录，图片为 `0.jpg, 1.jpg...`，视频为 `0.mp4...`。xhs-factory 已有按笔记打包 ZIP、可选图片；若要做「按任务导出到本地文件夹」，可参考其目录层级与命名。
- **并发与间隔**：`get_note_detail_async_task` 用 `Semaphore(MAX_CONCURRENCY_NUM)` 控制并发；每条详情拉取后固定 `random.uniform(7, 12)` 秒再继续，避免短时间大量请求。

---

## 一、架构与分层

### 1. 抽象基类清晰

- **`base/base_crawler.py`** 定义了：
  - `AbstractCrawler`：`start`、`search`、`launch_browser`（可选 `launch_browser_with_cdp`）
  - `AbstractLogin`：`begin`、`login_by_qrcode`、`login_by_mobile`、`login_by_cookies`
  - `AbstractStore`：`store_content`、`store_comment`、`store_creator`
  - `AbstractApiClient`：`request`、`update_cookies`
- **价值**：多平台（xhs/dy/ks/bili 等）共用同一套接口，扩展新平台时只需实现对应抽象类，便于维护和测试。

**可借鉴**：若 xhs-factory 未来只做小红书，不必强行上抽象层；若可能做多平台或多种存储，可先定义最小接口（如「解析单条笔记」「保存笔记」），再让现有实现符合该接口。

### 2. 平台模块内聚（media_platform/xhs）

- **client.py**：封装对小红书 API 的请求（含签名、重试、限流错误码处理）。
- **core.py**：爬虫流程（启动浏览器、登录、搜索、拉详情、行为模拟）。
- **extractor.py**：从 HTML / `__INITIAL_STATE__` 中解析笔记、创作者信息。
- **exception.py**：平台专属异常（如 `DataFetchError`、`IPBlockError`）。
- **playwright_sign.py**：在浏览器上下文中生成请求签名（X-S、X-T 等），避免纯 Node 逆向。

**可借鉴**：把「请求 + 签名」「解析」「异常」拆成独立模块，便于单测和替换；xhs-factory 当前 `scraper.py` 可逐步拆成「抓取 + 解析 + 错误类型」。

### 3. 配置集中、可覆盖（config）

- **base_config.py**：平台无关项（HEADLESS、登录类型、代理开关、爬取间隔、否词、批次输出等）。
- **xhs_config.py**：小红书专属配置（由 base 导入后再覆盖）。
- 支持环境变量 / 配置文件覆盖，便于不同环境（本地调试、限流严格）切换。

**可借鉴**：xhs-factory 已有 `BATCH_PARSE_CONCURRENCY` 等环境变量；可再集中一个 `config.py` 或 `settings.py`，把超时、并发、是否检测限流页等收拢，方便调参和文档化。

---

## 二、反爬与稳定性

### 1. 请求签名（Playwright 注入）

- 小红书接口需要 **X-S、X-T、x-S-Common** 等请求头。
- MediaCrawler 用 **Playwright 注入页面**，在浏览器里调用页面上的签名逻辑（如 `window.mnsv2`），得到签名后再用 httpx 发请求。
- **价值**：无需完全逆向 JS，利用真实浏览器环境生成合法签名，抗变更能力较好。

**可借鉴**：xhs-factory 当前是「Playwright 打开笔记页 → 读 `__INITIAL_STATE__`」，不做接口请求；若未来要抓搜索列表、评论等，需要调接口时，可参考其「Playwright 签好名 → 再用 httpx 请求」的模式。

### 2. 明确区分错误类型与重试

- **exception.py**：`DataFetchError`、`IPBlockError`（对应 300012 等）。
- **client.py**：对 `request` 使用 `@retry(stop=stop_after_attempt(3), wait=wait_fixed(1))`；对 471/461 验证码、IP 封禁等返回码单独处理并抛出自定义异常。
- 限流/封禁与普通网络错误分开，便于上层做「换 IP」「降频」「提示用户」等策略。

**可借鉴**：xhs-factory 已在爬虫里识别「安全限制 / 300013」并抛明确异常；可再定义 `RateLimitError`、`DataEmptyError` 等，在 API 层统一映射为 HTTP 状态或错误码，前端可据此做不同提示或重试策略。

### 3. 行为模拟（core.py）

- `_simulate_human_actions`：按一定频率执行「随机滚动」「随机点击空白区域」等，降低纯脚本特征。
- 配合爬取间隔（如 `CRAWLER_MAX_SLEEP_SEC`）、并发控制（`MAX_CONCURRENCY_NUM`），减轻被识别为机器请求的概率。

**可借鉴**：在批量解析时，除并发数外，可在每条笔记之间加 1～3 秒随机延迟，或每 N 条做一次轻量滚动/等待，有助于缓解「Too many requests」。

### 4. CDP 模式（可选）

- 支持用 Chrome DevTools Protocol 连接用户本机 Chrome/Edge，使用真实浏览器配置与 Cookie。
- 反检测能力优于纯 Playwright 启动的裸实例，适合登录态保持、风控严格场景。

**可借鉴**：若后续遇到「无头模式频繁限流、登录难」等问题，可评估为「可选 CDP 模式」，复用用户已登录的浏览器；实现成本较高，可作为进阶项。

---

## 三、存储与数据流

### 1. 多存储后端（store + factory）

- 支持 CSV、JSON、SQLite、MySQL、MongoDB、Excel 等，通过工厂创建对应 Store 实现。
- 爬虫只依赖「存储接口」，不关心具体落盘格式。

**可借鉴**：xhs-factory 当前是「前端 localStorage + 后端 ZIP 下载」；若以后需要「导出列表」「本地数据库」「同步到 Notion」等，可先抽象一个「保存笔记」接口，再挂多种实现，避免业务逻辑和存储耦合。

### 2. 缓存（cache）

- **ExpiringLocalCache**：内存 + 过期时间，带定时清理任务。
- 用于去重、限流计数、临时状态等，减少重复请求。

**可借鉴**：若做「解析历史去重」「同一链接 N 分钟内不重复抓」等，可引入轻量内存缓存（或直接用 Python 的 cachetools）；不必一开始就上 Redis。

---

## 四、工程化

### 1. 日志统一（tools/utils.py）

- `init_loging_config()` 统一格式：时间、logger 名、级别、文件名行号、消息。
- 对 httpx 等第三方库降级（如设为 WARNING），避免刷屏。

**可借鉴**：xhs-factory 后端可统一用 `logging`，格式与级别在入口配置一次，便于排查「限流」「解析失败」等问题。

### 2. API 与爬虫解耦（api/routers + services）

- **routers/crawler.py**：只做参数校验、调用 service、返回 HTTP 状态。
- **services/crawler_manager.py**：管理爬虫子进程、状态、日志拉取。
- 爬虫以「子进程」或「异步任务」运行，不阻塞 API 响应。

**可借鉴**：xhs-factory 当前是「请求进来 → 直接调 scraper」；若以后做「长时间批量任务」「任务队列」，可把「启动/停止/查状态」放到独立 service，API 只发指令和查结果。

### 3. 资源路径兼容打包（get_resource_path）

- 通过 `sys._MEIPASS` 区分「开发环境」与「PyInstaller 打包后」的资源根目录，避免打包后找不到 libs、配置文件等。

**可借鉴**：若 xhs-factory 做「一键打包成 exe」，脚本、配置、前端构建产物路径可参考该方式做兼容。

---

## 五、可直接用到 xhs-factory 的小改进

| 点 | MediaCrawler 做法 | 在 xhs-factory 的落地建议 |
|----|-------------------|---------------------------|
| 限流/错误码 | 300012→IPBlockError，471/461→验证码异常 | 已做 300013 检测；可再定义 RateLimitError，在接口层返回 429 或明确文案 |
| 请求重试 | tenacity 重试 3 次、间隔 1 秒 | 对单条笔记抓取失败可加 1～2 次重试（注意别加重限流） |
| 抓取间隔 | CRAWLER_MAX_SLEEP_SEC、行为模拟 | 批量解析时每条之间 random.sleep(1~3)，或每 N 条小歇一下 |
| 配置集中 | config/base + 平台 config | 把超时、并发、是否检测限流页等收进一个 config 或 env 文档 |
| 解析与抓取分离 | extractor 只做「从 HTML/state 抽数据」 | scraper 里「拿到 page → 取 __INITIAL_STATE__」与「从 state 抽 title/desc/images」可拆成两个函数，便于单测和换数据源 |
| 否词/过滤 | EXCLUDE_KEYWORDS、_should_exclude_note | 若需要「排除含某关键词的笔记」，可在解析后加一层过滤，再决定是否加入结果 |

---

## 六、小结

- **架构**：抽象基类 + 平台内聚（client / core / extractor / exception）值得学；xhs-factory 可按需逐步拆模块、加接口。
- **反爬与稳定性**：签名注入、错误类型、重试、行为模拟、CDP 可选，都是可借鉴方向；优先做「错误类型 + 重试 + 间隔」成本低、收益高。
- **存储与缓存**：多存储与缓存可作为扩展点，不必一步到位。
- **工程化**：统一日志、API 与爬虫解耦、资源路径兼容打包，对长期维护和分发有帮助。

以上均可按「当前需求 + 维护成本」分阶段采纳，不必一次性照搬。

---

## 七、与 MediaCrawler 的差异：为何「参考之后反而容易出问题」

### 笔记详情获取方式的根本差异

| 维度 | MediaCrawler | xhs-factory |
|------|--------------|-------------|
| **输入** | 配置里是**标准 explore URL**（含 note_id、xsec_token、xsec_source），或从搜索/创作者页得到 note_id + xsec | 用户粘贴**任意链接**（多为 xhslink 短链，也可能是已复制的 explore 链接） |
| **手段** | 先调**接口** `get_note_by_id`（需签名 + Cookie），失败再用 **httpx 请求** `https://www.xiaohongshu.com/explore/{note_id}?xsec_token=...` 拿 HTML，正则抠 `__INITIAL_STATE__` | **仅 Playwright 打开用户给的链接**，等页面加载后读 `window.__INITIAL_STATE__`，无登录、无签名 |
| **场景** | 搜索/创作者/指定笔记列表 → 已有 note_id 与 xsec → API 或一次 HTTP 即可 | 用户给一条链接 → 必须浏览器打开并跟随跳转（xhslink→笔记页） |

因此 MediaCrawler **没有**「用户贴 xhslink → 先 HTTP 跟跳再决定用哪个 URL」「等标题从首页变成笔记页」这类逻辑；他们的笔记详情是「已知 note_id + xsec 后请求固定 URL 或 API」。

### 参考后我们加过、且可能削弱稳定性的改动（已回滚/放宽）

1. **xhslink HTTP 预解析**  
   用 httpx 跟跳 xhslink；无 Cookie 时经常得到首页，我们就「改用原 xhslink、用浏览器打开」。原来则是**直接** `page.goto(用户链接)`，由浏览器自然跳转。预解析增加了超时与分支，反而可能更不稳。  
   **当前**：已回滚，**一律直接 `page.goto(url)`**，不再做 HTTP 预解析。

2. **等标题变为笔记页**  
   若 URL 是 xhslink 或非 explore，就 `wait_for_function` 等标题 ≠「小红书 - 你的生活兴趣社区」。若加载慢或先渲染成别的，25s 内没变就超时；原来没有这步，直接 sleep 后读 state 有时能读到。  
   **当前**：已去掉「等标题」逻辑，只保留 goto + sleep 2.5s + 读 state。

3. **过严的 wait_for_function**  
   之前要求 `noteDetailMap` 里第一条笔记**已有** title/desc/images 才返回 state。若页面是先注入空壳再异步填内容，就会一直等不到。  
   **当前**：改为只等 **noteDetailMap 存在且至少有一个 key** 就取 state；内容是否为空在 **extract_note_from_state** 里判断并抛 **DataEmptyError**。

### 宜借鉴 vs 不宜照搬（小结）

- **宜借鉴（已保留）**：抓取间隔、单条失败重试、限流/错误类型（RateLimitError、DataEmptyError）、解析与抓取分离、图片下载间隔、详细日志（XHS_CRAWL_DEBUG）。这些不改变「打开谁、等什么」。
- **不宜照搬**：笔记详情获取流程（API 优先、固定 explore URL + httpx）——我们无登录无签名，只能 Playwright 打开用户链接；以及「xhslink 预解析 + 等标题 + 过严的 state 条件」已回滚/放宽，恢复「直接 goto + 简单等 noteDetailMap 有 key」的可靠路径。
