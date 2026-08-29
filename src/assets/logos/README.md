# Server marks

The catalog draws each target with the mark of the server it runs, so a fleet can be read at a
glance rather than by comparing version strings. They are the projects' own marks, used to name
those projects — nothing here is Keydra's.

| File            | Source                                                                                                                                                                                     | Licence                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `redis.svg`     | [simple-icons](https://github.com/simple-icons/simple-icons) `icons/redis.svg`, painted `#FF4438` (the brand colour that icon set records)                                                 | CC0-1.0                                                                                      |
| `valkey.svg`    | [valkey-io.github.io](https://github.com/valkey-io/valkey-io.github.io) `static/img/Valkey-logo.svg`                                                                                       | Copyright 2024 Linux Foundation — the project's trademark, used here to identify the project |
| `keydb.svg`     | [keydb.dev](https://keydb.dev) `img/favicon/keydb-icon.svg`, editor metadata stripped and nothing else changed                                                                             | Copyright Snapchat Inc. — the project's trademark, used here to identify the project         |
| `dragonfly.svg` | [dragonflydb.io](https://www.dragonflydb.io) `favicon.svg`, plate removed and the mark filled with the violet-to-blue gradient the project's full logo is drawn in (`#5A3EE0` → `#3E74E0`) | Copyright DragonflyDB Ltd. — the project's trademark, used here to identify the project      |
| `garnet.png`    | [microsoft.github.io/garnet](https://microsoft.github.io/garnet) `img/garnet-logo-diamond.png`, cropped to the mark and scaled down                                                        | Copyright Microsoft Corporation — the project's trademark, used here to identify the project |
| `aerospike.svg` | [aerospike.com](https://aerospike.com) `favicon.svg`, its fixed width and height removed so it is drawn at the size the tile gives it                                                      | Copyright Aerospike, Inc. — the project's trademark, used here to identify the project       |
| `tikv.svg`      | [cncf/artwork](https://github.com/cncf/artwork) `projects/tikv/icon/color/tikv-icon-color.svg`, cropped to the mark with the wordmark removed                                              | Apache-2.0 (CNCF) — the project's trademark, used here to identify the project               |

None of KeyDB, Dragonfly, Garnet, Aerospike or TiKV is in simple-icons, so all five come from the
projects themselves. Five notes on why each needed anything doing to it at all:

- **The tile draws every mark on a white plate**, in every theme, because a brand mark is drawn to
  sit on white and recolouring somebody else's mark is the one thing their guidelines all agree
  about. That plate is why `keydb.svg` can keep its black line work: the white inside it is not
  painted, it is the plate showing through.
- **Dragonfly publishes only two things**: a full logo that is mark plus wordmark, twice as wide as
  it is tall, and a favicon whose mark sits on a filled circle that follows the browser's colour
  scheme. Neither belongs in a row of plain marks — the wordmark because it would be the only one,
  and the circle because it would be a badge on a plate, keyed to the browser rather than to this
  application's theme. What is here is the mark from the favicon in the full logo's own colours.
- **Aerospike publishes its mark on a yellow square**, and that square stays. The objection to
  Dragonfly's circle was that it followed the browser's colour scheme and so was not one thing; a
  fixed yellow ground is simply what this mark looks like, and it sits on the white plate the way
  Garnet's does.
- **TiKV publishes one file that is mark plus wordmark**, two and a half times as wide as it is
  tall. What is here is the hexagon from its left-hand end, at the same viewBox the original draws
  it in, with the three wordmark paths dropped and the stylesheet inlined as fills.
- **Garnet publishes no vector at all**, so this one is a bitmap among four SVGs. Cropped, because
  the published file is mostly white margin and would have drawn the mark at half the size of its
  neighbours, and scaled to 128 pixels tall — better than four times the size it is drawn at, so it
  stays sharp where the others are resolution-free. Its white ground is left alone rather than made
  transparent: the plate underneath it is white, and cutting an anti-aliased edge out of white
  leaves a halo that is worse than the thing it fixes.

Redis, Valkey, KeyDB, Dragonfly, Garnet, Aerospike and TiKV are trademarks of their respective owners. Replacing any of
these files is a one-line change: `ConnectionTile` picks the mark by the flavour the target
reported.
