# 北航四季主题 UI 复刻说明

## 交付目标与边界

请将目标网站的**前端视觉层**改造成「留白」当前的第二主题：**北航四季**。目标是复刻视觉语言、背景、布局、按钮反馈和切换动画，而不是复制本项目的页面内容。

必须保留目标网站现有的页面、路由、组件职责、表单提交、登录、接口调用、数据库与后端代码。允许改动的范围只有 HTML 结构外壳、CSS、前端静态素材引用，以及前端交互动效。不要接入或改动 Supabase，不要改 API，不要改数据模型，不要把页面改写成另一个产品。

实现时请结合目标网站已有页面决定每个按钮、卡片和列表的位置；下面给的是视觉系统和交互规范，不要求照搬「留白」的业务模块。

## 在线素材地址

部署站点根地址：`https://dobble-mode.vercel.app`。若素材被复制到目标网站的 `public/assets/` 下，请使用相同的相对地址；若直接引用线上素材，可使用下表 URL。

| 季节 | 主背景 | 线上地址 | 主强调色 | 氛围 |
| --- | --- | --- | --- | --- |
| 春 | `public/assets/seasons/spring.jpg`，8256 x 5504 | `https://dobble-mode.vercel.app/assets/seasons/spring.jpg` | `#d87891` | 粉色春日校园 |
| 夏 | `public/assets/seasons/summer.jpg`，1024 x 646 | `https://dobble-mode.vercel.app/assets/seasons/summer.jpg` | `#299b91` | 清爽青绿校园 |
| 秋 | `public/assets/seasons/autumn.jpg`，1024 x 682 | `https://dobble-mode.vercel.app/assets/seasons/autumn.jpg` | `#c7773e` | 暖橙秋日校园 |
| 冬 | `public/assets/seasons/winter.jpg`，5941 x 3961 | `https://dobble-mode.vercel.app/assets/seasons/winter.jpg` | `#5e9ec9` | 冷蓝冬日校园 |

辅助素材：

| 用途 | 本地文件 | 线上地址 | 用法 |
| --- | --- | --- | --- |
| 北航主题缩略图 | `public/assets/theme-icons/beihang-badge.jpg` | `https://dobble-mode.vercel.app/assets/theme-icons/beihang-badge.jpg` | 主题选择器的第二个圆角方形预览 |
| 北航主题陪伴角色 | `public/assets/companions/cream-companion.png` | `https://dobble-mode.vercel.app/assets/companions/cream-companion.png` | 右下角像素陪伴角色；仅目标网站本身存在相应角色入口时才使用 |
| 底部导航图标 | `public/assets/nav/1.png` 至 `4.png` | `https://dobble-mode.vercel.app/assets/nav/1.png` 等 | 可作为蒙版图标；不要求替换目标网站已有、辨识度更高的业务图标 |
| 预处理小尺寸背景 | `public/assets/seasons/*-pixel-v2.png`，1920 x 1080 | 对应同名 URL | 只适用于低性能兜底；正常情况优先用上方四张主背景 |

素材均是背景和装饰资源。不要将其作为带文字的内容卡片，也不要在背景上再叠加网格、棋盘格或伪像素噪点。

## 核心视觉规则

北航四季不是极简白色 SaaS 风格，也不是拟物校园海报。它的结构是「像素校园背景 + 半透明白色纸片 + 方正像素阴影」：

- 背景始终铺满整个窗口，固定在内容之后，不能在手机端留黑边、白边或只显示一块图片。
- 背景需真实像素化：先将图像按屏幕尺寸缩小到约 `1/5` 宽高，再关闭图像平滑后放大到视口。不要用 CSS 网格罩、`backdrop-filter` 噪点或马赛克滤镜假装像素化。
- 背景亮度略高但不发白：推荐 `saturate(1.07) contrast(1.04) brightness(1.04)`，整体不透明度约 `.86`。
- 内容并非一层巨大的白卡片。每一块信息、标题、说明、指标、按钮均有独立的半透明白色纸片作为可读性底板。
- 纸片是方形或最多 8px 小圆角，使用 2px 半透明白边与向右下偏移 3-5px 的蓝灰实色阴影。严禁胶囊卡片、过度大圆角和大面积渐变。
- 所有文字使用同一套圆润手写感中文字体；推荐 `ZCOOL KuaiLe`，回退 `YouYuan`、`Microsoft YaHei`、sans-serif。标题、标签、数据和按钮均为 700 字重；不要混用宋体。

全局色彩令牌：

```css
:root[data-theme='beihang-seasons'] {
  --canvas: #dcecff;
  --paper: rgba(246, 250, 255, .94);
  --panel: rgba(255, 255, 255, .72);
  --panel-strong: rgba(255, 255, 255, .90);
  --ink: #16476a;
  --muted: #527898;
  --line: rgba(255, 255, 255, .86);
  --primary: #347fbd;
  --orange: #e3a252;
  --shadow: rgba(35, 91, 135, .20);
  --season-accent: #c7773e; /* 由当前春夏秋冬替换 */
}
```

## 页面外壳与排布

### 桌面端

- 画布最小宽度 320px，内容最大宽度 1120px，居中；页面四周留 28px 呼吸区。
- 主容器可有极浅白色透明底和极细白边，但不能抢过背景。容器内部底部预留至少 86px，避免固定底栏挡住内容。
- 顶栏从左到右：品牌/返回入口、生活/专业模式切换器、主题缩略图组、四季切换器、账号/个人入口。目标站没有其中某项时，不要凭空增加业务按钮；保留其位置与同类密度即可。
- 生活首页推荐三栏：左侧窄栏放导航或个人提示，中间放主要任务/列表/内容，右侧窄栏放时钟、日历、数字或快捷信息。比例约为 `0.76 : 1.36 : 0.88`，栏间距 14-18px。
- 普通列表页、详情页和专业页面仍沿用同一套纸片与按钮，不改原有信息架构。不要把所有模块塞进一张大卡片。
- 底部导航固定在视口底部居中，最大宽度 420px，高 66-70px，四等分。使用深蓝文字/图标；激活项使用 `--primary`，并可加季节色的小像素标记。

### 手机与窄屏

- 小于 700px 时，主容器全宽，左右无外边距；内容左右留 12-13px。
- 顶栏改为四行：第一行品牌和账号，第二行模式切换，第三行主题缩略图，第四行四季切换。不能让控件重叠或被裁切。
- 小于 480px 时，模式切换器占满一整行；季节按钮允许横向滚动；所有双栏、三栏数据卡改为单栏。
- 底栏固定 `left: 8px; right: 8px; bottom: max(8px, env(safe-area-inset-bottom)); width: auto; transform: none`。这是为了避免手机浏览器将桌面端 `translateX(-50%)` 继承后导致底栏偏移。
- 背景要按 `cover` 裁切填满竖屏。移动端不要用 `contain`；先保留画面中心，再根据目标页面的重要主体把 `background-position` 微调至 `50% 50%`。不得拉伸原图。

## 背景实现方案

推荐使用 canvas，确保是真实像素化。每次窗口尺寸变化时重绘：

1. 创建全屏固定 canvas，位于页面最底层，`pointer-events: none`。
2. canvas 内部尺寸设为 `ceil(viewportWidth / 5)` 与 `ceil(viewportHeight / 5)`。
3. 关闭 `imageSmoothingEnabled`。
4. 以 `cover` 比例绘制当前季节背景：`scale = max(canvasWidth/imageWidth, canvasHeight/imageHeight)`。
5. 以中心为默认焦点裁切，手机端仍使用中心焦点。canvas 用 CSS 拉伸为 `100vw x 100vh`，浏览器像素放大时保持清晰的像素块。

如果目标项目不适合 canvas，可以使用同一张背景加 `image-rendering: pixelated` 作为降级方案，但禁止额外覆盖网格层。四季背景只替换图像和 `--season-accent`，不改变页面布局。

## 控件与组件风格

### 主题与四季选择

- 主题选择器是一个半透明白色方框，内含 3 个约 50-60px 的方形图像缩略图。北航四季是第二项，预览使用 `beihang-badge.jpg`。
- 当前主题有 3px 深蓝描边或 outline，放大到约 `1.08`；不能只用文字写「已选」。
- 选中北航四季后显示 4 个季节按钮：春、夏、秋、冬。按钮尺寸紧凑，背景为半透明白，激活项使用当前 `--season-accent` 作为底色，文字为白色。
- 若目标网站已有主题菜单或设置页，则把以上视觉放进原来的菜单，不另造第二套设置流程。

### 内容纸片

```css
.paper-tile {
  color: var(--ink);
  background: rgba(255, 255, 255, .72);
  border: 2px solid rgba(255, 255, 255, .86);
  border-radius: 0; /* 若目标网站已有 6-8px 角，可保留该小圆角 */
  box-shadow: 5px 5px 0 rgba(23, 59, 88, .14);
}
.text-backplate {
  display: inline-block;
  max-width: 100%;
  padding: 5px 8px;
  color: var(--ink);
  background: rgba(255, 255, 255, .78);
  border: 2px solid rgba(255, 255, 255, .88);
  box-shadow: 3px 3px 0 rgba(23, 59, 88, .12);
  line-height: 1.65;
}
```

所有可能直接压在背景上的标题、说明、数字、图表标签、空状态提示均应使用 `.text-backplate` 或被完整纸片包裹。这样文字始终清晰，不会和校园背景混在一起。

### 按钮

- 主按钮：蓝色 `#347fbd` 填充、白字、2px 白边、4px 右下阴影、方正轮廓。
- 次按钮：白色半透明底、深蓝字、相同白边和偏移阴影。
- 图标按钮优先使用目标项目已有图标；若没有，才使用小像素图标。不要把功能名都做成大号圆角矩形。
- hover：向上 3px、缩放到 `1.02-1.06`、略提高饱和度，180ms。
- active：向下 1px、缩放到 `.92-.97`，阴影缩短，160-180ms。
- 禁用：降低不透明度，不删除布局位置。

### 字体与层级

- UI 正文、按钮、表单、数据：`'ZCOOL KuaiLe', 'YouYuan', 'Microsoft YaHei', sans-serif`，字重 700。
- 日期、很小的标注、像素数字：可用 `'Silkscreen', 'Pixelify Sans', monospace`，但只用于少量数据点。
- 常规页面标题 30-38px；卡片标题 18-24px；正文 13-15px；小标签 11-12px。不要用 hero 级大字挤压业务内容。

## 动画规范

动画的作用是让纸片和像素世界有触感，不是持续装饰。必须支持：

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
  }
}
```

### 季节切换

切换春夏秋冬时，旧背景和新背景需同时存在 900ms：

- 旧背景：从不透明度 `.86` 淡至 0，同时变亮、略降饱和度，像退到白纸后。
- 新背景：从不透明度 0 出现，初始略亮、略低饱和度，逐渐加深至 `.86`。
- 曲线：`cubic-bezier(.22,.78,.24,1)`。
- 内容纸片、边框、文字色、阴影同期间以 650-900ms 过渡。不要闪白，不要突然换背景，不要出现两个并排背景。

```css
@keyframes theme-background-deepen {
  from { opacity: 0; filter: brightness(1.34) saturate(.72) contrast(1.01); }
  to { opacity: .86; }
}
@keyframes theme-background-lighten {
  from { opacity: .86; }
  to { opacity: 0; filter: brightness(1.38) saturate(.62) contrast(.98); }
}
```

### 日常交互

- 主题缩略图、四季按钮、卡片和底栏项目：hover 上浮 2-4px；点击轻压，不要弹跳过猛。
- 右下角陪伴角色（仅当目标站已有此功能）：hover 上移 5px、放大到 1.08、轻微旋转 -3deg；面板用 210ms 的小幅向上 pop-in 出现。
- 页面内容切换优先使用 180-260ms 的淡入位移，不做整页翻转、复杂粒子或无法关闭的循环动效。

## 交给 AI 的实施清单

1. 先识别目标网站的根容器、顶栏、内容区、导航和现有按钮组件；不改它们的数据和事件。
2. 建立北航四季 CSS token 与 `data-theme='beihang-seasons'`（或目标站等价的 theme class）。
3. 把上述四张主背景放入目标站静态资源目录，完成 canvas 像素背景和四季切换状态。
4. 依照现有页面结构重做纸片、标题底板、按钮、图标、顶栏和固定底栏的视觉，不增加新业务页面。
5. 完成桌面、平板、手机竖屏三个断点；检查每一处文字、按钮、卡片不会重叠或被底栏遮挡。
6. 加入上述交互动效和 reduced-motion 降级。
7. 最后检查：背景无网格罩、无黑边、无拉伸；手机背景铺满；所有文字都能在背景上读清；后端与 API 文件没有改动。

## 验收标准

- 任意页面切换到北航四季后，呈现清晰像素化校园背景和蓝白纸片界面。
- 春夏秋冬只改变背景与强调色，不改变业务数据、按钮功能、路径或 API。
- 桌面 1120px 内容居中且不拥挤；手机竖屏单列，无卡片/顶部控件/底栏重叠。
- 季节切换为 900ms 的背景淡出与加深过渡；按钮 hover/active 有一致的小幅实体反馈。
- 浏览器关闭动画偏好后，界面仍完整可用且动画被明显降低。
- 目标项目的后端、Supabase、接口、数据库迁移、认证与状态管理均未修改。
