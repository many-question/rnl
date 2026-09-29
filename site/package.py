"""把介绍网页打包成可以单独移植展示的产物。

产物：
- rnl-intro-standalone.html：单文件版，样式和脚本全部内联，可以直接发送、双击打开，
  或放到任何静态托管上；
- rnl-intro.zip：站点目录（index.html、assets/、.nojekyll）加单文件版和使用说明，
  解压后可以直接部署到 GitHub Pages 或其他静态主机。

用法（在仓库根目录）：
    python site/package.py [输出目录]
默认输出到 site/dist/（dist/ 已被 git 忽略）。只用 Python 标准库。
"""
import sys
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
SCRIPTS = ["schem.js", "rnl-code.js", "scenes.js", "intro.js"]
STYLE_TAG = '<link rel="stylesheet" href="assets/intro.css">'

GUIDE = """RNL 介绍网页 · 独立包

两种用法：
1. 单文件：rnl-intro-standalone.html 已经内联了全部样式和脚本，双击就能在浏览器里打开，
   也可以直接发给别人。
2. 站点目录：rnl-intro/ 里是 index.html 和 assets/，整个目录上传到任意静态主机即可；
   放进 GitHub 仓库时，把目录内容放在 GitHub Pages 发布的分支（或 docs/ 目录）里。
   .nojekyll 让 GitHub Pages 跳过 Jekyll 处理，原样发布。

两种用法都从 Google Fonts 加载字体；离线时退回系统字体，页面照常可用。
页面里的 RNL 写法按当前讨论稿（1.16 方案，2026-09-29）示意，不是已发布的格式。
"""


def read(path):
    return path.read_text(encoding="utf-8")


def standalone_html():
    """把 index.html 引用的样式和脚本内联进去，得到单文件版。"""
    html = read(HERE / "index.html")
    if STYLE_TAG not in html:
        raise SystemExit("index.html 里找不到样式引用：" + STYLE_TAG)
    css = read(HERE / "assets" / "intro.css")
    html = html.replace(STYLE_TAG, "<style>\n" + css + "\n</style>", 1)
    for name in SCRIPTS:
        tag = '<script src="assets/%s"></script>' % name
        if tag not in html:
            raise SystemExit("index.html 里找不到脚本引用：" + tag)
        js = read(HERE / "assets" / name)
        if "</script" in js.lower():
            raise SystemExit(name + " 里含有 </script，不能直接内联")
        html = html.replace(tag, "<script>\n" + js + "\n</script>", 1)
    if 'src="assets/' in html or 'href="assets/' in html:
        raise SystemExit("单文件版里仍有对 assets/ 的引用")
    return html


def main():
    out = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else HERE / "dist"
    out.mkdir(parents=True, exist_ok=True)

    single = standalone_html()
    single_path = out / "rnl-intro-standalone.html"
    single_path.write_text(single, encoding="utf-8", newline="\n")

    zip_path = out / "rnl-intro.zip"
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("rnl-intro/index.html", read(HERE / "index.html"))
        for name in ["intro.css"] + SCRIPTS:
            zf.writestr("rnl-intro/assets/" + name, read(HERE / "assets" / name))
        zf.writestr("rnl-intro/.nojekyll", "")
        zf.writestr("rnl-intro-standalone.html", single)
        zf.writestr("使用说明.txt", GUIDE)

    print("单文件版：%s（%d KB）" % (single_path, (single_path.stat().st_size + 1023) // 1024))
    print("压缩包：  %s（%d KB）" % (zip_path, (zip_path.stat().st_size + 1023) // 1024))


if __name__ == "__main__":
    main()
