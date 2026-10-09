# 网页编辑与自动发布说明

完成一次设置后，有编辑权限的人可以直接打开 `/admin/`，填写表单并提交。提交会把内容和新增照片写入同一条 GitHub 提交，GitHub Actions 随后自动生成并发布网站，无需在本地运行 `build.cmd`，也无需你逐次审核。

“提交成功”表示资料已保存到仓库；公开页面要等自动部署成功才会更新，通常需要几分钟。编辑页和公开网站均为英文，本说明供管理员维护使用。

## 1. 管理员一次性设置

1. 解压更新后的源码包，将其中的文件上传到**实际的网站仓库** `main` 分支的根目录。必须包括 `admin/`、`data/`、`assets/`、`tools/`、`package.json`、`.nojekyll` 和 `.github/workflows/deploy.yml`。仓库根目录直接有这些项目，不要再套一层文件夹，也不要只上传 ZIP。
2. 在 GitHub 仓库确认可以直接看到 `.github/workflows/deploy.yml`。如果网页上传时漏掉它，用 **Add file → Create new file**，填写这个完整路径，将本地同名文件的内容复制进去后提交。第一次安装使用仓库管理员的正常 GitHub 登录账号即可，日常内容编辑者不需要 Workflows 权限。
3. 进入仓库 **Settings → Pages**，将 **Build and deployment → Source** 改为 **GitHub Actions**。这里替代原来的 **Deploy from a branch** 发布方式。[GitHub 发布设置说明](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
4. 进入 **Actions → Build and deploy lab website → Run workflow**，选择 `main` 并运行。等 `build` 和 `deploy` 两项都变绿，再打开网站的 `/admin/`。
5. 以后编辑者提交到 `main` 会自动发布。此流程生成的 HTML 只存在于部署文件中，不会自动写回仓库根目录；日常维护以 `data/site.json` 为准。仓库根目录的旧 HTML 不应当作为是否更新成功的依据。

如果组织的 Actions 策略限制可用 action，需要允许此工作流使用的 GitHub 官方 `actions/*`。如果分支规则要求所有更改都走 Pull Request，或 `github-pages` 环境要求人工审批，那么自动提交或发布仍会被规则拦住。要实现本次选择的“有权限的人提交后直接发布”，管理员需要为网站内容维护配置允许的直接写入和无需逐次人工审批的部署权限；页面不会绕过现有规则。

工作流使用 GitHub 自动提供的 `GITHUB_TOKEN`，只给构建 `contents: read`，给部署 `pages: write` 和 `id-token: write`。**不需要创建任何仓库 Secret，也不要把个人 token 写到配置文件或工作流。**它只上传 `dist` 内的公开网页，不发布维护文档、源工具或 `.qa` 文件。[GitHub 自定义 Pages 工作流说明](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

## 2. 确认编辑器连接哪个仓库

编辑页显示的 Owner、Repository 和 Branch 应当对应真正发布这个网站的仓库。默认目标是：

| 字段 | 内容 |
|---|---|
| Owner | `malab-tju` |
| Repository | `MaLab-TJU.github.io` |
| Branch | `main` |

2026-10-06 已读取 GitHub 确认：当前网站仓库为 `malab-tju/MaLab-TJU.github.io`，默认分支为 `main`，根网站已启用。GitHub API 对仓库名大小写不敏感。若以后网站迁回 `https://xiangyudongai.github.io/MaLab-TJU.github.io/`，应连接 `xiangyudongai / MaLab-TJU.github.io / main`。编辑页会尝试根据 GitHub Pages 网址推断目标；连接前仍请核对页面显示的仓库。

如果需要固定目标，可在 `admin/config.json` 修改 `owner`、`repo`、`branch`。该文件是公开配置，只填写仓库信息，不填写 token。发布分支不是 `main` 时，也要同步修改工作流的 push 分支与 deploy 条件。

完成编辑器首次部署后，编辑地址为：

- 组织根网站：`https://malab-tju.github.io/admin/`
- 旧个人项目网站：`https://xiangyudongai.github.io/MaLab-TJU.github.io/admin/`

## 3. 给编辑者授权

对于实验室组织仓库，请先将每位编辑者邀请为 `malab-tju` 的 **Member**，待其接受邀请后，再通过团队或仓库访问设置授予**这个网站仓库的 Write 权限**。不需要赋予组织 Owner 或仓库 Admin。组织成员身份与具体仓库 Write 权限是两个不同设置。[邀请组织成员](https://docs.github.com/en/organizations/managing-membership-in-your-organization/inviting-users-to-join-your-organization)、[管理仓库访问权限](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/managing-teams-and-people-with-access-to-your-repository)

目前 GitHub fine-grained token 不支持组织仓库的 **outside collaborator** 写入，所以仅把编辑者设为外部协作者不能满足本页面的 token 方案。如果仓库仍在 `xiangyudongai` 个人账号下，该账号本人可以使用自己的 fine-grained token；要让其他人也按这里的方式维护，请先把仓库放到实验室组织，并添加他们为组织成员。[GitHub token 支持范围](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)

## 4. 每位编辑者创建自己的 token

每人用自己的 GitHub 账号完成一次：

1. 打开 [Fine-grained token 创建页面](https://github.com/settings/personal-access-tokens/new)，填写名称，例如 `MaLab website editor`，并选择到期时间。
2. **Resource owner** 选择真正拥有网站仓库的账号或组织。迁移完成后应选 `malab-tju`，不能选编辑者自己的个人账号。
3. **Repository access** 选择 **Only select repositories**，仅勾选网站仓库 `MaLab-TJU.github.io`。不要选 **All repositories**。
4. **Repository permissions** 中设置 **Contents → Read and write**；**Metadata → Read-only** 通常会自动包含。其余权限不用添加，尤其无需 Workflows、Administration、Pages 或 Secrets 权限。
5. 创建 token。如果组织要求审批，需要组织 Owner 在组织 **Settings → Personal access tokens → Pending requests** 批准后，才能写入。Pending 状态的 token 只能读取公开资料。若 Resource owner 列表里没有组织，先确认已接受成员邀请以及组织允许 fine-grained token。[token 配置说明](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)、[组织审批说明](https://docs.github.com/en/organizations/managing-programmatic-access-to-your-organization/managing-requests-for-personal-access-tokens-in-your-organization)

Token 代表自己的仓库权限，每个人使用自己的 token，不共享管理员 token。编辑器只在当前页面的内存中保留它，不写入网页文件、浏览器本地存储或仓库；刷新、退出连接或关闭页面后需要重新连接。Token 到期或被撤销后，在 GitHub 创建或更换自己的 token 即可。

## 5. 日常修改

1. 打开已发布网站的 `/admin/`，核对目标仓库和分支，用自己的 token 点击 **Connect GitHub**。
2. 等页面载入仓库的最新内容，再选择栏目，填写英文资料。People 页仍按 **Faculty / Ph.D. Students / Master’s Students / Research Interns** 分组。
3. 修改完成后点击 **Submit changes**。页面会显示 GitHub 保存结果，自动发布由仓库的 **Actions** 记录确认。
4. 等部署完成，再打开公开网站检查。若刚部署后浏览器仍显示旧内容，可刷新页面。

编辑页本身可以公开打开，但打开它不会得到写入权限。提交请求必须通过 GitHub 的 token 权限与分支规则检查；没有网站仓库写权限的人不能用这个页面修改网站。这不是靠隐藏 `/admin/` 或前端密码限制的权限。

未完成的修改可用 **Download draft** 下载（包括新照片和原始版本），以后用 **Import draft** 恢复。连接时会保留远端未被自己修改的字段；双方修改同一字段或列表时，页面会保留草稿并提示冲突，先下载草稿再载入最新版处理。旧版无原始版本的草稿必须明确确认整份替换，才允许提交。

## 6. 出错时检查哪里

| 现象 | 检查 |
|---|---|
| 无法连接或保存，提示 401 | token 是否复制完整、过期或已撤销 |
| 能看内容但不能保存，提示 403/404 | Resource owner、仓库选择、Contents 权限、组织审批、成员身份与仓库 Write 权限 |
| 提交被分支规则拒绝 | 管理员检查该分支是否允许编辑者直接提交 |
| 保存成功但网站没有变化 | 检查 Actions 的构建/部署结果、Pages Source 是否为 GitHub Actions，以及 `github-pages` 环境审批 |
| 编辑了错误的网站仓库 | 检查页面的 Owner/Repository/Branch 和 `admin/config.json` |
| 新的编辑页面显示 404 | 首次源码上传是否包含 `admin/`，以及第一次自动部署是否成功 |

如果构建失败，公开网站会继续保留上一次成功部署的版本。管理员可以查看 Actions 日志，修正资料或恢复之前的 `data/site.json`，再提交触发发布。

## 工作流使用的官方 actions

核对日期：2026-10-06。当前工作流使用 Node.js 24，无外部 npm 依赖，不执行 `npm install`：

- [actions/checkout v7](https://github.com/actions/checkout/releases)
- [actions/setup-node v7](https://github.com/actions/setup-node/releases)
- [actions/upload-pages-artifact v5](https://github.com/actions/upload-pages-artifact/releases)，通过 `include-hidden-files: true` 保留构建目录中的 `.nojekyll`
- [actions/deploy-pages v5](https://github.com/actions/deploy-pages/releases)
