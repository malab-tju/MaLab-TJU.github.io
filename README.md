# 马晓光教授课题组主页

沿用 [Huazhe Xu 学术主页](http://hxu.rocks/index.html) 的简洁内容组织，现已根据[天津大学人工智能学院马晓光教授官方介绍](https://sai.tju.edu.cn/info/1361/6321.htm)更新。保留首页、研究成果、团队成员、加入我们、联系我们五个栏目，适合 GitHub Pages。

网站访客页面现为全英文：Home、Publications、People、Join Us、Contact。正文和姓名也请填写英文。中文 README 与资料来源说明供本地维护使用。

当前版式采用白底、深蓝链接和统一的文字层级。首页以研究主题为主标题，导师照片与身份信息放在右侧，研究方向用横向定义行展示；论文保持紧凑的引用列表。页头副标题默认留空，填写后会以普通小字显示。

现在还提供英文 **`admin/` 内容编辑页面**，可用表单维护全部内容。按 [EDITOR_SETUP.md](EDITOR_SETUP.md) 完成一次设置后，有权限的人提交即可自动生成并发布网页。

后台提供论文、老师、博士、硕士、实习生和新闻的快捷新增入口；自动生成新论文编号和成员缩写，支持照片上传、草稿导入导出，以及使用正式网页模板的五页未发布预览。预览不需要 GitHub 登录，提交需要自己的有效编辑权限。

**已生成完整网页，可以直接双击 `index.html` 浏览。上传这些现成网页不需要安装依赖或配置构建服务。**

当前已采用公开可核对的教授简介、官方照片、三个研究方向、五篇论文、三个科研项目、两则学术动态、招募说明及联系邮箱。资料核对日期：2026-09-25。

“Xiaoguang Ma Research Group”是本地网站的描述性名称，并非已核实的正式实验室命名。官网未列出的学生姓名、成员照片、办公室房间号和邮编没有补造；成员页保留“将陆续更新”，来访地址通过邮件确认。来源与论文版本差异见 [SOURCES.md](SOURCES.md)。

## 1. 在自己的电脑上查看

双击文件夹中的 `index.html`，浏览器会打开首页。顶部可以切换五个栏目，所有内容均为静态 HTML，不依赖 JavaScript、网络字体或第三方 CDN。

也可以在当前文件夹打开终端，运行 `npm start`，再访问 <http://127.0.0.1:4173>。按 `Ctrl+C` 结束预览。此方式需要 Node.js 18 或更高版本；当前电脑已经检测到 Node.js 24。

## 2. 修改内容

日常只需编辑 **`data/site.json`**，保存后双击 **`build.cmd`** 更新网页。也可以运行 `npm run build`。不需要 `npm install`。

更新成功后刷新浏览器。如果直接修改生成的 HTML，下次生成时会被覆盖，因此请把长期修改写进内容文件。

| 要改的内容 | `data/site.json` 中的位置 |
| --- | --- |
| 英文课题组名称、页头副标题、学校 | `site.name`、`site.subtitle`、`site.institution` |
| 浏览器图标的字母 | `site.mark`，建议 1–2 个字母；页面不显示字母徽标 |
| 网站描述、公开邮箱、地址、邮编 | `site.description`、`site.email`、`site.address`、`site.postalCode` |
| 资料核对日期 | `site.updated`，格式 `2026-09-25`，保存在网页元数据中 |
| 首页大标题、简介、招募短文 | `home` |
| 研究方向 | `research` |
| 新闻动态 | `news`，新的条目放在最前面 |
| 论文和代表性成果 | `publications`，`selected: true` 的论文显示在首页 |
| 科研项目 | `projects` |
| 老师信息 | `team.teachers`，每位老师对应一个条目 |
| 导师经历与教育背景 | 对应老师条目中的 `experience`、`education` |
| 博士、硕士和实习生 | `team.groups` 中对应分组的 `members` |
| 招生、实习和申请说明 | `join` |
| 来访和交通说明 | `contact` |

JSON 中的键名和文字要保留英文双引号，每个条目之间用英文逗号，最后一项后面不加逗号。普通文字里的英文双引号写成 `\"`。内容按普通文本处理，不需要写 HTML。

`build.cmd` 需要电脑上有 Node.js 18 或更高版本。换电脑后如未安装，可以从 [Node.js 官方网站](https://nodejs.org/) 安装 LTS 版本。已经生成的网页在任何电脑上查看和上传都不需要 Node.js。

### 替换首页图片与成员照片

1. 把自己的图片复制进 `assets/images/`，建议用不含空格的英文文件名。
2. 首页图片修改 `site.image`，例如 `assets/images/lab.jpg`；同时修改 `imageAlt`（图片文字说明）和 `imageCaption`（图片下的图注）。
3. 当前首页使用官方教师照片，`site.imagePortrait: true` 表示竖版肖像。换成横向实验室照片时改为 `false`，并更新 `imageWidth`、`imageHeight`、`imageCaption` 和 `imageSource`（来源链接，可留空）。
4. 成员照片在对应成员的 `photo` 中填写，例如 `assets/images/member-zhang.jpg`。留空时显示字母缩写，不会出现损坏的图片。
5. 建议照片控制在 500 KB 左右。所有图片路径区分大小写，尤其注意 `.jpg` 和 `.JPG`。
6. 保存内容文件并运行 `build.cmd`。

当前使用 `assets/images/ma-xiaoguang.jpg`，来自学院教师名录，页面保留来源链接。原先的 AI 工作台图不再显示。页面图片均为本地文件，不依赖第三方图片请求。

### 增加论文链接

找到对应论文的 `links`，改成类似这样：

```json
"links": [
  { "label": "PDF", "url": "./assets/papers/paper.pdf" },
  { "label": "Code", "url": "https://github.com/YOUR-USERNAME/YOUR-REPOSITORY" }
]
```

自行在 `assets/` 下新建 `papers` 文件夹并放入真实 PDF；GitHub 地址也要换成真实链接。不填写链接时，页面不会展示无效按钮。

添加论文时可以复制已有完整条目。每篇论文的 `id` 必须唯一，只用小写英文字母、数字和短横线，例如 `robot-learning-2026`；`year` 使用四位年份。首页和成果页都以紧凑的引用列表显示，每篇为“作者. 题名. 会议或期刊及年份.”，成果页按年份从新到旧排列。题名优先链接到 PDF、DOI、arXiv 或正式出版记录，否则使用首个有效链接。`abstract`、`note` 和额外资源链接仍保存在内容文件和编辑器中，但不在公开页面展开。当前作者统一用 `et al.` 简写，完整署名请查看题名链接中的原文。

新闻的 `date` 支持 `2026.06.01`，应填事件发生日期；`url` 指向对应官方报道。当前两则报道的发布日期与事件日期不同，页面使用事件日期。

团队页依次显示 Faculty、Ph.D. Students、Master's Students、Research Interns 四组。马晓光教授位于 `team.teachers`，教育与工作经历可在页面展开。新增老师时，在该数组中添加同结构的条目即可。

`team.groups` 已建立博士、硕士和实习生三个分组；目前每组 `members` 都为空，页面显示待更新说明。拿到名单后，修改对应分组的 `members`，例如：

```json
"members": [
  { "name": "Alex Brown", "englishName": "", "role": "Robot Learning", "initials": "AB", "photo": "", "url": "" }
]
```

### 添加学术和代码主页

在 `site.links` 中添加链接，会显示在页头和联系页面；在对应老师条目的 `links` 中添加个人链接；每位学生或实习生的 `url` 可以填写个人主页。`links` 数组格式与上面的论文链接相同。外部链接填写完整的 `https://...` 地址。

### 示例模式与公开资料

当前 `site.demo` 已为 `false`，原有虚拟内容已替换或移除。若以后用本站制作另一份示例模板，可改为 `true`，显示示例提示并暂时关闭邮箱点击功能。

`site.sourceUrl` 控制每页页脚的官方资料链接。`site.postalCode` 留空时隐藏邮编栏目。新增成员和照片时请使用确认可公开的资料。

## 3. 上传 GitHub 并开启在线编辑

当前公开网站为 `https://malab-tju.github.io/`，仓库为 `malab-tju/MaLab-TJU.github.io`。新版编辑地址在首次部署完成后为 `https://malab-tju.github.io/admin/`。

1. 解压更新后的 `lab-homepage-upload.zip`，上传里面的文件到现有仓库 `main` 根目录，包含 `admin`、`data`、`assets`、`tools` 和 `.github` 文件夹；不要只上传 ZIP 或再套一层文件夹。
2. 检查 `.github/workflows/deploy.yml` 已上传。漏掉时用 **Add file → Create new file** 创建该路径，复制本地对应文件的内容。
3. 进入仓库 **Settings → Pages**，把 **Source** 设为 **GitHub Actions**。
4. 进入 **Actions → Build and deploy lab website → Run workflow**，选择 `main`；构建与部署成功后打开网站 `/admin/`。
5. 给编辑者组织 Member 身份与该仓库 Write 权限。每位编辑者配置自己的、只允许该仓库 Contents 读写的 fine-grained token，然后在编辑页连接、填写和提交。

详细步骤、组织审批、草稿恢复及出错排查见 [EDITOR_SETUP.md](EDITOR_SETUP.md)。新版工作流从 `data/site.json` 生成网页并发布，不把生成的 HTML 写回仓库。网页更新以成功部署后的公开站点为准。

仅本地查看和维护仍可双击 `index.html`、运行 `build.cmd`。要查看编辑页请运行 `npm start`，然后访问 `http://127.0.0.1:4173/admin/`；编辑页使用模块与 JSON 请求，不能通过双击 HTML 完整运行。

## 4. 文件结构

```text
index.html                 首页
publications.html          研究成果
team.html                  团队成员
join.html                  加入我们
contact.html               联系我们
assets/css/style.css       样式、颜色和手机布局
assets/images/             首页图片与成员照片
data/site.json             日常维护的内容文件
tools/build.mjs            从内容文件生成五个静态页面
tools/preview.mjs          仅用于本机的预览服务
admin/                     英文内容编辑页与 GitHub 提交逻辑
admin/site-renderer.mjs     正式网站构建和后台草稿预览共用的模板
.github/workflows/deploy.yml 自动生成并部署到 GitHub Pages
EDITOR_SETUP.md            在线编辑的一次性设置说明
build.cmd                  Windows 双击更新网页
package.json               可选的命令入口，无第三方依赖
.nojekyll                  告诉 GitHub 直接发布静态文件
```

需要调整公开网页布局时修改 `admin/site-renderer.mjs`，调整字体、宽度或颜色时修改 `assets/css/style.css`；`tools/build.mjs` 负责读取、校验与生成文件。CSS 顶部的 `--blue` 与 `--blue-dark` 控制主题色。修改共享模板后，后台预览与下一次构建会同时使用新布局；本地生成网页仍需运行 `build.cmd`，只改 CSS 时刷新页面即可。

公开网站未接入统计或联系表单。联系链接打开访客的邮件软件；内容编辑页通过 GitHub API 将修改提交到仓库，随后自动发布。网站没有自动同步教师官网或抓取论文的功能，后续仍需编辑者维护真实资料。更新源码上传包时要重新打包，原压缩包不会自动变化。

## 5. 常见问题

- **只改了 JSON，网站没有变化？** 本地查看需要运行 `build.cmd`。开启新版自动发布后，提交 JSON 到 `main` 会由 GitHub Actions 自动生成；查看 Actions 是否成功。
- **运行时报 JSON 错误？** 检查英文双引号、逗号和括号是否成对；根据报错修正后再运行。生成失败时原有页面会保留。
- **照片在本地能显示，上传后不显示？** 检查图片是否一并上传、文件名大小写是否完全一致、路径是否使用 `/`。
- **显示旧内容？** 等待 Pages 发布结束，尝试 `Ctrl+F5` 刷新。
- **研究方向或成员有变化？** 修改内容文件并重新生成即可；更新导师职务、项目、论文接收状态时，也请同步维护资料来源和更新时间。

最初的许华哲主页仅作为排版参考；当前马晓光教授的公开资料、照片与论文来源单独记录于 `SOURCES.md`。未使用任何参考网站的跟踪脚本。
