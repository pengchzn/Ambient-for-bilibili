# Privacy practices 表单材料

依据当前 1.0.0 源码整理。表单字段可能调整，应以开发者后台实际显示为准，并与 下方的隐私说明 一致。

## Single purpose / 单一用途

在哔哩哔哩播放页面根据视频色彩生成氛围光，并将相关页面背景与播放器布局适配这一视觉效果。

## storage 权限理由

使用 chrome.storage.local 保存用户选择的氛围光参数、开关和布局偏好，使设置在刷新页面或重启浏览器后继续生效。不会保存视频、评论正文、账号信息或观看历史，也不使用同步存储或向开发者上传。

## 网站访问 / Host access 理由

内容脚本仅匹配 https://www.bilibili.com/*、https://live.bilibili.com/* 和 https://player.bilibili.com/*。需要在这些页面读取当前播放路由、原生视频像素及播放器/评论容器布局，以生成页面氛围光并定位设置入口。效果仅在识别到的播放路由启用；不访问其他网站，不读取账号 Cookie，也不改写视频 URL。

Manifest 没有额外的 host_permissions 或 all_urls 权限；如果后台将 content_scripts 的匹配范围列入网站访问理由，使用上面的说明。

## Remote code / 远程代码

选择「No, I am not using remote code」。

所有执行的 JavaScript、CSS、shader 和图标均随扩展包提供。扩展不下载或执行外部代码，也不调用开发者服务器。

## Data usage / 数据使用

不能把「不上传数据」写成「不处理网站内容」。本扩展会在本机读取视频帧和相关页面 DOM，当前 URL 用于判断播放路由。按照官方 FAQ，本机处理也需要披露。

在列出的数据类别中披露 Website content（网站内容）及覆盖页面 URL 的 Web history（浏览活动）；说明其仅在本机处理。其余列出的敏感类别不选择。这样不会把本地取色和当前 URL 判断误写为完全不处理数据。

| 类别 | 当前实现 |
| --- | --- |
| Website content / 网站内容 | 本机处理视频像素、播放状态与相关页面结构/布局，仅用于效果。不提取评论正文，不持久保存或传输。应披露此类别。 |
| Web history / 网页历史或浏览活动 | 披露当前 B 站页面 URL 路由的本地处理。没有 history 权限，不遍历历史，不保存访问列表或传输 URL。 |
| 个人身份、健康、财务、认证信息 | 不收集、不读取登录 Cookie 或密码。 |
| 个人通讯、精确位置、键盘/鼠标行为追踪 | 不提取通讯/评论正文、不定位、不记录交互行为；普通控件事件只用于操作当前界面。 |

可在后台数据使用说明中填写：

Video pixels, playback state, relevant page structure/layout and the current Bilibili playback route are processed locally solely to render ambilight and position its controls. No website content, URLs, settings or usage data are transmitted to the developer or third parties. No viewing history or comment text is extracted or persisted. User preferences remain in chrome.storage.local.

本扩展符合以下实际声明：不出售或转让用户数据；不用于与单一用途无关的功能；不用于信用评估或借贷。选择相应认证前，核对发布版本与本声明一致。

## Privacy policy URL

填写本仓库公开的隐私说明链接：`https://github.com/pengchzn/Ambient-for-bilibili/blob/main/store/privacy-fields.md#隐私说明可公开使用`。提交表单前，在未登录窗口确认链接可访问。

参考：[隐私字段](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)、[本地数据处理披露 FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)。

## 隐私说明（可公开使用）

Ambient light for Bilibili™ 在本机处理当前 B 站页面的播放路由、视频像素、播放状态和相关 DOM 布局，仅用于生成氛围光及定位控件；不读取账号 Cookie、密码或评论正文，不记录观看历史。视频像素与渲染缓存只在当前页面会话的内存中处理，不保存为录像或截图。

用户偏好保存在浏览器的 chrome.storage.local 中，不同步或上传。扩展没有服务器、遥测或广告，也不向开发者或第三方传输、出售数据。卸载扩展会删除其本地设置；用户主动导出的 JSON 文件需单独删除。禁用或卸载后刷新页面即可停止本地处理。

如需联系维护者，可使用本仓库的 GitHub Issues。B 站、Chrome 和用户主动使用的 GitHub 服务遵循各自隐私政策。
