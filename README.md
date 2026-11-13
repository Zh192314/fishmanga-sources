# fishmanga-sources

给 **大肥鱼漫画（FishManga）** 用的图源集合。

这些 `.js` 是 **Venera 格式源**的兼容封装：内部带一个纯 JS 运行时
（HTML 解析 + CSS 选择器 + Network/Convert 垫片），运行时再去上游拉真实的源配置。

主工程：https://github.com/Zh192314/fishmanga

---

## 怎么用（推荐：链接导入）

App 里「设置 → 图源 → **粘贴链接导入**」，粘下面对应的地址：

| 源 | 导入地址 |
|---|---|
| 包子漫画 | `https://cdn.jsdelivr.net/gh/Zh192314/fishmanga-sources@main/baozi.js` |
| 拷贝漫画 | `https://cdn.jsdelivr.net/gh/Zh192314/fishmanga-sources@main/copy_manga.js` |
| 漫画柜 | `https://cdn.jsdelivr.net/gh/Zh192314/fishmanga-sources@main/manhuagui.js` |
| 漫画人 | `https://cdn.jsdelivr.net/gh/Zh192314/fishmanga-sources@main/manhuaren.js` |
| 再漫画 | `https://cdn.jsdelivr.net/gh/Zh192314/fishmanga-sources@main/zaimanhua.js` |
| 爱看漫 | `https://cdn.jsdelivr.net/gh/Zh192314/fishmanga-sources@main/ikmmh.js` |
| 优酷漫画 | `https://cdn.jsdelivr.net/gh/Zh192314/fishmanga-sources@main/ykmh.js` |
| 漫画1234 | `https://cdn.jsdelivr.net/gh/Zh192314/fishmanga-sources@main/mh1234.js` |
| 漫小肆 | `https://cdn.jsdelivr.net/gh/Zh192314/fishmanga-sources@main/mxs.js` |
| GoDa漫画 | `https://cdn.jsdelivr.net/gh/Zh192314/fishmanga-sources@main/goda.js` |
| 热辣漫画 | `https://cdn.jsdelivr.net/gh/Zh192314/fishmanga-sources@main/hot_manga.js` |
| 嗨皮漫画 | `https://cdn.jsdelivr.net/gh/Zh192314/fishmanga-sources@main/happy.js` |
| CCC追漫台 | `https://cdn.jsdelivr.net/gh/Zh192314/fishmanga-sources@main/ccc.js` |
| 漫蛙吧 | `https://cdn.jsdelivr.net/gh/Zh192314/fishmanga-sources@main/manwaba.js` |
| jcomic | `https://cdn.jsdelivr.net/gh/Zh192314/fishmanga-sources@main/jcomic.js` |
| Komiic | `https://cdn.jsdelivr.net/gh/Zh192314/fishmanga-sources@main/komiic.js` |
| MangaDex | `https://cdn.jsdelivr.net/gh/Zh192314/fishmanga-sources@main/manga_dex.js` |
| comick | `https://cdn.jsdelivr.net/gh/Zh192314/fishmanga-sources@main/comick.js` |
| 少年ジャンプ＋ | `https://cdn.jsdelivr.net/gh/Zh192314/fishmanga-sources@main/shonen_jump_plus.js` |
| カドコミ | `https://cdn.jsdelivr.net/gh/Zh192314/fishmanga-sources@main/comic_walker.js` |

> jsDelivr 有缓存（约 12 小时）。改了源想立刻生效，把地址里的 `@main` 换成具体 commit 短哈希即可。

也支持「粘贴代码导入」和「从「文件」导入」：直接把这个文件的内容或文件本身喂给 App。

---

## 注意

- 这些源指向的站点内容版权归原站与作者所有，仅供个人学习研究。
- 站点改版、反爬升级都会让对应源失效，这与 App 无关。
- 源的实现（兼容层）在主工程的 `tools/venera/` 下，用 `node tools/venera/build_all.mjs` 重新生成。
