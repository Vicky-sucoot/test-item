#!/usr/bin/env bash
# 將 review-app/pwa 發布到 gh-pages 分支（GitHub Pages）
# 用法：在專案根目錄執行 bash review-app/pwa/publish.sh（需先 commit 最新的 review-app/pwa）
set -euo pipefail
node review-app/pwa/build.mjs
if ! git diff --quiet -- review-app/pwa; then
  echo "review-app/pwa 有尚未 commit 的變更，請先 commit 後再發布。" >&2
  exit 1
fi
git branch -D gh-pages-publish >/dev/null 2>&1 || true
git subtree split --prefix review-app/pwa -b gh-pages-publish
git push origin gh-pages-publish:gh-pages
git branch -D gh-pages-publish
echo "已發布：https://vicky-sucoot.github.io/test-item/"
