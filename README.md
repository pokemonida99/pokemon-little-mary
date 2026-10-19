# 寶可夢小瑪莉

台灣傳統小瑪莉（水果盤）跑燈機台的網頁版，水果換成寶可夢。桌機、手機都能玩，純前端（`index.html`＋`core.js`＋`game.js`），不用安裝。

線上玩：https://pokemonida99.github.io/pokemon-little-mary/

- 外圈 24 燈、8 個押注鍵（皮卡丘 ×5 … 超夢 ×100）
- 特殊燈：精靈球送燈、進化連發、卡比獸鬧鐘、傳說燈（開火車、大四喜、大小三元、縱橫四海、流星雨、彩金）
- 得分後可以比大小翻倍
- 統計、圖鑑、成就都存在瀏覽器裡（網址加 `?reset` 可清除）

設計與機率見 [設計書.md](設計書.md)。重算期望值：`node tools/sim.mjs 2000000`。

影片素材沿用 [P 寶可夢 雷光RUSH](https://github.com/pokemonida99/pachinko-modern)，已去掉音軌；音效全部是 WebAudio 即時合成。
粉絲自製免費遊戲，不能儲值、不能兌換。寶可夢相關名稱與角色屬於原權利人。
