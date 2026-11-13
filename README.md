# fishmanga-sources

给 **大肥鱼漫画（FishManga）** 用的图源集合。

这些 `.js` 是 **Venera 格式源**的兼容封装：内部带一个纯 JS 运行时
（HTML 解析 + CSS 选择器 + Network/Convert 垫片），运行时再去上游拉真实的源配置。

主工程：https://github.com/Zh192314/fishmanga

---

## 首选：单文件总源（一次导入，20 站）

**`venera-all.js`** —— 一个文件里塞了 20 个站点，按搜索词前缀路由。

装好之后，在「发现」页搜索框里这样用：

| 你输入 | 结果 |
|---|---|
| `baozi 海贼` | 包子漫画搜「海贼」 |
| `copy_manga 恋爱` | 拷贝漫画搜「恋爱」 |
| `manhuagui 进击` | 漫画柜搜「进击」 |
| `海贼`（不带前缀） | 默认站点（包子漫画）搜「海贼」 |
| `?` | 弹出可用站点一览 |

前缀也可以写冒号：`baozi:海贼`。

### 可用站点 key

```
baozi          包子漫画        copy_manga      拷贝漫画
manhuagui      漫画柜          manhuaren       漫画人
zaimanhua      再漫画          ikmmh           爱看漫
ykmh           优酷漫画        mh1234          漫画1234
mxs            漫小肆          goda            GoDa漫画
hot_manga      热辣漫画        happy           嗨皮漫画
ccc            CCC追漫台       manwaba         漫蛙吧
jcomic         jcomic.net      komiic          Komiic
manga_dex      MangaDex        comick          comick
shonen_jump_plus 少年ジャンプ＋ comic_walker    カドコミ
```

### 导入方式（哪个能通就用哪个）

1. **粘贴代码**：打开本页的 `venera-all.js` → 右上角复制图标（Copy raw file）→ App「设置 → 图源 → 粘贴代码导入」→ 文件名 `venera-all.js`
2. **从文件导入**：把 `venera-all.js` 下载到「文件」App → App「从「文件」导入 .js」
3. **链接导入**（需要 CDN 可访问，国内常被掐）：
   - `https://cdn.jsdelivr.net/gh/Zh192314/fishmanga-sources@main/venera-all.js`
   - `https://cdn.statically.io/gh/Zh192314/fishmanga-sources/main/venera-all.js`

---

## 备选：单站源（一个站一个文件）

如果只想要某个站，也可以单独导入：

| 源 | 文件 |
|---|---|
| 包子漫画 | `baozi.js` |
| 拷贝漫画 | `copy_manga.js` |
| 漫画柜 | `manhuagui.js` |
| 漫画人 | `manhuaren.js` |
| 再漫画 | `zaimanhua.js` |
| 爱看漫 | `ikmmh.js` |
| 优酷漫画 | `ykmh.js` |
| 漫画1234 | `mh1234.js` |
| 漫小肆 | `mxs.js` |
| GoDa漫画 | `goda.js` |
| 热辣漫画 | `hot_manga.js` |
| 嗨皮漫画 | `happy.js` |
| CCC追漫台 | `ccc.js` |
| 漫蛙吧 | `manwaba.js` |
| jcomic | `jcomic.js` |
| Komiic | `komiic.js` |
| MangaDex | `manga_dex.js` |
| comick | `comick.js` |
| 少年ジャンプ＋ | `shonen_jump_plus.js` |
| カドコミ | `comic_walker.js` |

---

## 注意

- 这些源指向的站点内容版权归原站与作者所有，仅供个人学习研究。
- 站点改版、反爬升级都会让对应源失效，这与 App 无关；`设置 → 源调试日志` 里能看到具体报错。
- 兼容层实现在主工程 `tools/venera/` 下，重新生成用 `node tools/venera/build_all.mjs` 与 `node tools/venera/build_multi.mjs`。
