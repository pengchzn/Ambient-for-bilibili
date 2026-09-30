# Chrome Web Store materials

当前准备版本：**1.0.0**。材料已在本地准备，不代表已经上传或通过审核。

| 文件 | 用途 |
| --- | --- |
| `listing.zh-CN.md` | 中文名称、短简介、详细介绍 |
| `privacy-fields.md` | 单一用途、权限理由、远程代码和本地数据处理声明 |
| `reviewer-instructions.md` | 审核人员可复现的使用步骤及适配边界 |
| `../extension/icons/128.png` | 128×128 商店图标，主体 96×96、透明留白 |
| `assets/promo-440x280.png` | 必需的小宣传图 |
| `screenshots/01-web-fullscreen.png` | 1280×800，真实 B 站网页全屏 |
| `screenshots/03-comments.png` | 1280×800，真实 B 站滚动背景（未登录） |

设置面板截图和 README 图片的商店尺寸版本仅保留在本地 `dist/store-screenshots/`，不纳入 Git 仓库。

上传 `dist/ambient-light-for-bilibili-1.0.0-store.zip`，手动安装包为 `ambient-light-for-bilibili-1.0.0.zip`，不是商店上传包。安装包由 `npm run package` 生成，ZIP 根目录直接包含 `manifest.json`。

商店的隐私政策 URL 必须填写发布后可公开访问的隐私说明地址，可使用本目录 `privacy-fields.md` 中「隐私说明（可公开使用）」段落的公开链接，不能填写本地路径或尚不存在的链接。仓库创建后再填支持 URL、官网 URL 等可选字段。中文扩展界面尚未提供英文翻译，因此首发商店语言使用「简体中文」。

图片和 ZIP 根结构按 [Chrome 图片规范](https://developer.chrome.com/docs/webstore/images) 与 [打包要求](https://developer.chrome.com/docs/webstore/prepare) 准备。
