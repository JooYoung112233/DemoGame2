# 레퍼런스 이미지 생성 프롬프트

> 다른 이미지 생성 AI에 넣을 프롬프트 모음
> 설계 근거는 [DESIGN.md](DESIGN.md) 14장(레이아웃), 4장(심볼) 참조

---

## 0. 사용법

1. **먼저 §1 팔레트 블록을 모든 프롬프트 앞에 붙인다.** 여러 장을 한 세트로 보이게 하는 핵심이다
2. §2 전체 화면 구도부터 뽑는다 — 이게 기준이 되고, 나머지는 여기에 맞춘다
3. §5 심볼 시트는 **가장 중요하다.** 뽑은 뒤 반드시 §5.1 검증을 거친다
4. Midjourney면 각 프롬프트 끝의 `--ar` / `--no` 를 그대로 쓰고, GPT/Nano Banana 계열이면 그 부분은 지우고 본문만 넣는다

---

## 1. 공통 스타일 블록 (모든 프롬프트 앞에 붙일 것)

```
Pixel art, limited palette of 20 colors, crisp 1px dark outlines, no
anti-aliasing, no dithering gradients, flat color fills, clean readable
shapes, orthographic front-facing view, single warm light source from
above (stage spotlight).

TONE, most important: MUTED and DESATURATED. Grim, sombre, restrained.
No neon, no glow effects, no shine. Reference the grim washed out palette
of Darkest Dungeon, not a mobile casino app.

Palette, use only these:
  deep plum black    #1A1024
  dark plum          #2E1B38
  stage floor        #3B2438
  shadow violet      #1F1430
  dull crimson       #7A2029
  faded velvet       #5E1A20
  tarnished brass    #9C7A3C
  dark bronze        #6B5426
  bone              #C9BCA4
  dim cream          #DCCFB4
  spotlight cone     #E8CE95
  cold steel         #6B7A8C
  dried blood        #A33A34

Mood: an old opera house turned into a travelling circus. Faded velvet,
tarnished brass, warm lamplight against deep shadow. Slightly sinister
but not gory. Vintage carnival poster feeling.
```

### 1.1 톤 규칙 — 캐주얼해지지 않게 하는 법

3차 결과물은 배치와 정보량은 맞았지만 **캐주얼했다.** 원인과 규칙:

| 캐주얼해지는 원인 | 규칙 |
|---|---|
| 큰 발광 SPIN 버튼 | 버튼을 좁고 얇게, 글자는 작은 대문자 자간만 넓게. 발광 없음 |
| 순수 빨강 HP · 순수 파랑 쉴드 | HP는 **마른 피 색**, 쉴드는 **차가운 강철 회색**. 파랑을 쓰지 않는다 |
| 반짝이는 새 금색 테두리 | **변색된 황동**. 탁하고 약간 녹회색. 노란 금은 금지 |
| 글로우 남용 | **빛나는 것은 스포트라이트 원뿔과 페이라인 딱 둘뿐.** 나머지는 발광 없음 |
| 균일한 금테 + 둥근 모서리 | 프레임은 1px, 각진 모서리 |

**핵심 원칙:**

> **UI는 명도로 분리하고 채도로 분리하지 않는다.**

어두운 배경 위에서 UI가 읽히려면 밝기만 올리면 된다. 채도까지 올리면 배경과 재질이 달라져 스티커처럼 붙어 보인다. UI는 배경보다 **밝지만 똑같이 탁해야** 한다.

프롬프트 `--no` 에 항상 넣을 것: `glow, bloom, neon, shiny gold, saturated colours, pure red, pure blue, large button text, rounded plastic UI, mobile casino`

---

## 2. 전체 화면 구도 (제일 먼저 뽑을 것)

세로 플레이 영역이 극장 프레임 안에 액자처럼 들어간 구도. **이 게임의 정체성을 결정하는 한 장.**

```
[공통 스타일 블록]

A video game screen composition seen head-on, 16:9 canvas.

The centre of the canvas is a TALL VERTICAL PANEL occupying about 42% of
the width, aspect ratio 3:4, framed like an opera house proscenium. This
vertical panel is the playfield: a small circus stage at the top with a
crimson valance and scalloped curtain edge, and a dark wooden control
console at the bottom.

The LEFT and RIGHT of the canvas are the theatre interior, NOT empty
space: tiered box seats with gold railings and dark crimson velvet,
carved plaster scrollwork, wall sconces with warm flames. Deep shadow
between the boxes.

At the TOP CENTRE, above the proscenium arch, a tarnished gold crest and
a small chandelier hanging on a chain.

At the BOTTOM, spanning the full width, the silhouetted heads and
shoulders of an AUDIENCE seen from behind, dark against the lit stage.
Some figures standing, some seated.

Symmetrical composition. The vertical panel is clearly brighter than the
surrounding theatre interior so the eye goes to it first.

--ar 16:9 --no text, letters, numbers, watermark, logo, UI icons, modern
interface, photorealism, 3d render, blurry
```

---

## 2.3 전투 화면 · UI 레이어 포함 ★ 현재 기준

§2.4 결과물은 **배경 아트 레퍼런스로는 완성품**이었지만 게임처럼 보이지 않았다. 원인은 프롬프트에서 `--no text, letters, numbers, UI` 로 HUD를 통째로 차단한 것이다.

### 2.3.1 게임처럼 보이게 하는 세 가지

| 원칙 | 이유 |
|---|---|
| **UI는 배경 위에 떠 있어야 한다** | 슬롯 프레임이 배경과 같은 톤이면 무대 세트 속 소품으로 읽힌다. 별개 레이어로 보여야 조작 가능해 보인다 |
| **밝기를 반대로 나눈다** | 배경은 거의 검게, UI와 슬롯은 밝고 선명하게. `VERY DARK`를 전체에 걸면 UI까지 죽는다 |
| **UI는 원근을 주지 않는다** | 소실점이 강하면 "그림"으로 읽힌다. 배경만 원근, 슬롯과 HUD는 화면에 평행하게 정렬 |

### 2.3.2 UI 레이어 체크리스트

| 위치 | 요소 |
|---|---|
| 상단바 | 스테이지 진행, 금화 카운터, 일시정지 |
| 적 위 | 의도 배지 — **적마다 하나씩** |
| 적 아래 | HP바 + 숫자 |
| 슬롯 좌측 | 페이라인 램프 5개 |
| 슬롯 우측 | 콤보 배수 배지 |
| 슬롯 하단 | 회전권 카운터 · **큰 스핀 버튼** · 오토 버튼 |
| 하단 | 행동 카드 4개 + 각 비용 배지 |
| 최하단 | 캐릭터 초상화 + HP바 + 쉴드바 |

### 2.3.3 프롬프트

```
Pixel art GAME SCREEN with a full HUD, vertical 3:4 canvas, dark crimson
and tarnished gold opera house. This is a working game interface, NOT an
illustration.

LIGHTING SPLIT, important: the theatre background is VERY DARK, near
black silhouettes with thin warm rim light. The HUD panels, the slot
window and the buttons are LIGHTER than the background and clearly
readable, visibly floating above it as a separate layer — but they are
separated by BRIGHTNESS ONLY, never by saturation. The interface is just
as muted and desaturated as the scene. All metal is tarnished brass, dull
and slightly green-grey, never shiny yellow gold. Health bar is dull
dried blood red, not pure red. Shield bar is cold grey steel, not blue.
Frames are THIN, one pixel, hard cornered, not rounded.

The ONLY glowing things in the entire image are the stage spotlight cone
and the thin payline across the middle slot row. Nothing else emits light.

FLAT ALIGNMENT: the slot window and all HUD panels are perfectly
rectangular and aligned to the screen edges, no perspective distortion.
Only the background theatre has perspective.

TOP BAR: a slim lit panel across the top edge holding a small stage
counter badge on the left, a gold coin counter next to it, and a small
square pause button on the right.

STAGE, upper 35%: three sinister circus performers standing in a row lit
by one overhead spotlight - a tall gaunt clown, a short cracked wooden
puppet, a heavy muzzled bear. ABOVE each figure floats a small bright
diamond shaped intent badge containing a weapon icon. BELOW each figure
sits a short bright RED HEALTH BAR in a thin gold frame. These badges and
bars are the brightest things on the stage.

MIDDLE: a 3 by 3 slot window in a slim bright gold frame. The middle row
glows strongly with a gold line across it. Top and bottom rows dim. Nine
different clearly distinct icons in the cells: dagger, open hoop, cotton
candy cloud, joker card, balloon, three juggling balls, wide cannon,
notched ticket, stack of gold coins. LEFT of the window, a vertical strip
of five round lamps, one lit. RIGHT of the window, a bright circular
combo badge.

BELOW the slot: a NARROW, SHORT, dark crimson SPIN button with a thin
brass edge, no bevel and no glow, roughly one third of the screen width.
Its label is SMALL widely spaced capitals occupying very little of the
button. The button must be visibly QUIETER than the slot window. A small
ticket counter panel to its left, a circular auto-repeat button to its
right.

BOTTOM: a row of four compact square action cards in lit gold frames,
each with a small cost badge in its corner. Below them a slim status bar
with a small character portrait on the left and a red health bar and blue
shield bar beside it.

FOREGROUND: the back of the player's head and shoulders in silhouette at
the very bottom centre, small, rim lit, framed by dark audience
silhouettes on both sides.

--ar 3:4 --no glow, bloom, neon, shiny gold, saturated colours, pure red,
pure blue, large button text, rounded plastic UI, mobile casino, bright
background, flat even lighting, daylight, dramatic perspective on the
interface, photorealism, 3d render, cropped figures
```

`--no` 에서 **text·numbers 금지를 뺐다.** 이미지 AI가 만드는 글자는 깨지지만, 레퍼런스에서 중요한 건 **UI 덩어리의 위치와 밝기**다. 깨진 글자는 Unity에서 실제 텍스트로 교체한다.

---

## 2.4 배경 아트 레퍼런스 · 로우앵글 어두운 버전 ★ 배경 판으로 확정

UI 없는 순수 배경·분위기 판. **이 결과물은 배경 레이어 레퍼런스로 확정됐다** — 극장 원근, 관객 실루엣, 조명, 팔레트가 모두 기준값이다. UI는 §2.3에서 따로 뽑아 이 위에 얹는다.

```
Pixel art, limited palette, crisp 1px dark outlines, flat colour fills,
no gradients. VERY DARK overall image, high contrast, deep shadow
everywhere. The ONLY lit areas are the stage spotlight and the glowing
slot machine. Background walls, balconies and audience are almost black
silhouettes with only thin warm rim light. Moody, dim, nocturnal.

Vertical game screen, 3:4 canvas. Crimson and tarnished gold opera house.

FOREGROUND, bottom third, seen from BEHIND: a young performer standing in
the audience aisle with their back to us, dark silhouette rim lit from
the stage, looking UP toward the stage. In front of them, an ornate slot
machine cabinet they are operating. We are standing with this character,
looking up at the enemies. Low camera angle.

STAGE, upper 40%, ABOVE and beyond the player, raised higher than the
viewer: three sinister circus performers standing in a row, full bodies,
lit hard by a single overhead spotlight - a tall gaunt clown, a short
cracked wooden puppet, a heavy muzzled bear on hind legs. They look DOWN
at the viewer.

BETWEEN them, dark tiered balconies packed with near black audience
silhouettes, only the tops of their heads catching light.

SLOT WINDOW, middle: a 3 by 3 grid in a SLIM gold frame, minimal
ornament. Middle row brightly lit with a thin gold line across it. Top
and bottom rows dim. A narrow vertical strip of FIVE small round lamps on
its left, only the middle one lit.

Inside the nine cells, NINE DIFFERENT small icons, all clearly different
silhouettes: a thin dagger, an open striped hoop, a fluffy cotton candy
cloud, a rectangular joker card, a round balloon with a tail, three small
juggling balls, a low wide cannon, a notched paper ticket, and a stack of
GOLD COINS.

BOTTOM EDGE: a SLIM horizontal bar of four SMALL square action icons,
compact, taking up very little height. Not large cards.

--ar 3:4 --no text, letters, numbers, words, watermark, bright
background, flat even lighting, daylight, large action cards,
photorealism, 3d render, cropped figures
```

핵심 지시:

| 지시 | 이유 |
|---|---|
| `VERY DARK`, `The ONLY lit areas are…` | 1차 결과가 전체적으로 너무 밝아 대비가 죽었다 |
| `seen from BEHIND`, `Low camera angle`, `They look DOWN at the viewer` | 플레이어를 객석에 두고 적을 올려다보는 대결 구도 → DESIGN.md 9.0 |
| `Not large cards`, `SLIM horizontal bar` | 1차에서 행동 카드가 화면 높이를 너무 먹었다 |
| `NINE DIFFERENT small icons` + `GOLD COINS` | 심볼 종류가 적어 보였고 금화가 없었다 |
| `SLIM gold frame, minimal ornament` | 프레임 장식이 두꺼워 무대 높이를 먹었다 |
| `full bodies` + `cropped figures` 금지 | 1차에서 보스가 반신만 나왔다 |

---

## 2.5 잡몹 3마리 전투 화면 (밝은 초기 버전 · 보관용)

§2에서 나온 보스전 구도는 좋았지만 **잡몹 3마리를 세울 무대 높이가 없었다.** 무대를 키우고 슬롯 프레임 장식을 얇게 한 버전이 필요하다.

```
[공통 스타일 블록]

A vertical game screen composition, 3:4 canvas, ornate pixel art UI in a
crimson and gold opera house.

TOP 45% of the canvas is the STAGE, and it must be TALL enough for full
body figures. Standing on the stage floor, THREE sinister circus
performers in a row, evenly spaced, full bodies visible from head to
foot, facing the viewer:
  LEFT   a tall gaunt clown in a patched ruffled collar, holding a knife
  CENTRE a short jointed wooden puppet with a cracked porcelain face
  RIGHT  a heavy muzzled bear on hind legs in a tattered gold vest
Each figure a clearly different height and body shape. A pool of warm
spotlight on the floor beneath them. Behind them, a crimson curtain
valance with scalloped hem, chandeliers, and rows of dark audience
silhouettes in tiered balconies.

MIDDLE 35% is a slot machine window: a 3 by 3 grid of square cells in a
SLIM gold frame with minimal ornament, no light bulbs around the rim. The
middle horizontal row is brightly lit with a thin glowing gold line
across it and a small diamond marker at each end. The top and bottom rows
are dimmer. To the LEFT of the window, a narrow vertical strip holding
FIVE small round payline indicator lamps stacked vertically, only the
middle one lit.

BOTTOM 20% is a control bar: a wide crimson SPIN button in the centre, a
small counter panel on the left, a circular auto button on the right, and
below that a row of FOUR small action cards.

Empty cells, no symbols drawn inside the grid.

--ar 3:4 --no text, letters, numbers, words, watermark, symbols inside
cells, cherries, sevens, photorealism, 3d render, cropped figures,
half bodies
```

**핵심 지시 세 개**를 프롬프트에 넣어둔 이유:

- `TALL enough for full body figures` / `full bodies visible from head to foot` — 첫 시도에서 보스가 반신만 나왔다
- `SLIM gold frame with minimal ornament, no light bulbs` — 슬롯 프레임 장식이 두꺼워서 무대 높이를 먹었다
- `FIVE small round payline indicator lamps` — 라인 성장이 1→3→5이므로 칸이 5개여야 한다

---

## 3. 무대 + 잡몹 3마리 (단독)

세로 영역 상단(무대) 부분만. 적 3마리가 서 있는 배치.

```
[공통 스타일 블록]

A small circus stage seen head-on, vertical 3:4 canvas.

Top edge: a crimson curtain valance with a scalloped lower hem and gold
tassels. Thin crimson curtain panels down the left and right edges only,
about 8% of the width each, so the middle stays open.

Standing on the stage floor, three sinister circus performers in a row,
evenly spaced, facing the viewer:
  LEFT   a tall gaunt clown in a patched ruffled collar, wide painted
         grin, holding a throwing knife
  CENTRE a small jointed wooden puppet with a cracked porcelain face and
         visible string joints, shorter than the others
  RIGHT  a heavy muzzled circus bear standing on hind legs wearing a
         tattered gold-trimmed vest

Each figure is a clean readable silhouette, clearly different in height
and body shape from the other two.

A pool of warm spotlight glow on the floor beneath them. Deep shadow
above and behind.

--ar 3:4 --no text, letters, numbers, health bars, UI, watermark, gore,
blood, photorealism, 3d render
```

---

## 4. 슬롯 조작 패널 + 레버

세로 영역 하단(조작 패널). 3×3 창과 우측 레버.

```
[공통 스타일 블록]

A close-up of an antique slot machine control panel, seen head-on,
wide 4:3 canvas.

Dark carved wood cabinet with tarnished gold edging and small round
rivets. On the LEFT three quarters, a recessed viewing window divided
into a 3 by 3 grid of square cells with brass dividers. The MIDDLE
horizontal row of cells is lit brighter than the top and bottom rows,
with a thin gold winning line running across it and a small arrow marker
pointing at it from each side. The top and bottom rows are dimmer, half
in shadow.

On the RIGHT quarter, a long vertical LEVER mounted on the cabinet side:
a brass shaft with a round crimson ball knob at the top, and a curved
slot the shaft travels in.

Below the window, a narrow brass strip with three empty round indicator
sockets.

The cells are EMPTY, no symbols drawn inside them.

--ar 4:3 --no text, letters, numbers, symbols inside cells, fruit
symbols, cherries, sevens, watermark, photorealism, 3d render
```

---

## 5. 심볼 시트 8종 ★ 가장 중요

**실루엣이 서로 구분되는지가 이 게임의 아트 제약 전체를 결정한다.** ([DESIGN.md](DESIGN.md) 15장 첫 항목)

```
[공통 스타일 블록]

A sprite sheet of 8 circus-themed game icons, arranged in a 4 by 2 grid
on a plain dark plum background. Each icon sits in its own cell, centred,
same size, generous margin around it.

Each icon must have a DISTINCT OUTER SILHOUETTE, readable at very small
size and while blurred. No two icons may share a similar outline.

  1  THROWING KNIFE   long thin blade, narrow vertical silhouette
  2  CANNON           squat wide barrel on a small carriage, low and wide
  3  HOOP             a perfect open ring, hollow centre
  4  BALLOON          a round balloon with a small star on it and a short
                      curled string, circle plus tail silhouette
  5  COTTON CANDY     a fluffy irregular cloud on a thin stick, bumpy
                      cloud-like outline
  6  JUGGLING BALLS   three small solid circles in a triangle arrangement
  7  JOKER CARD       a rectangular playing card, straight hard edges,
                      the only rectangle in the set
  8  TICKET           a torn paper stub with a notched scalloped edge,
                      slanted parallelogram silhouette

Bold simple shapes, thick dark outline, minimal interior detail. Flat
colours only. Each icon uses one dominant hue from the palette so the
eight read as different colours as well as different shapes.

--ar 2:1 --no text, letters, numbers, labels, captions, watermark, thin
lines, tiny details, gradients, photorealism, 3d render
```

### 5.1 실루엣 검증 (반드시 할 것)

뽑은 시트를 그냥 보면 다 구분됩니다. **회전 중에 구분되는지가 문제**입니다.

1. 시트를 **16×16 픽셀로 축소**해서 본다
2. 원본에 **강한 블러**를 걸어본다
3. 심볼을 **검정 실루엣으로만** 채워서(내부 디테일 제거) 나란히 놓아본다

세 번째가 결정적입니다. 실루엣만 남겼을 때 **헷갈리는 쌍이 있으면 그 심볼은 탈락**입니다. 8종이 다 통과하지 못하면 6종으로 줄이고, 아래 우선순위로 자릅니다.

| 우선 | 심볼 | 이유 |
|---|---|---|
| 필수 | 단검 · 후프 · 솜사탕 | 공격 · 방어 · 회복. 기본 처리의 뼈대 |
| 필수 | 조커 | 유일한 사각형이라 실루엣이 확실하고, 3연속 일치를 성립시키는 핵심 |
| 높음 | 저글링 공 | 콤보 축. 원 3개라 실루엣이 독특 |
| 높음 | 풍선 | 회피. 원+꼬리라 실루엣이 명확 (원래 외줄 신발이었으나 교체) |
| 중간 | 티켓 | 재화. 잘리면 전투 보상으로 대체 가능 |
| 낮음 | 대포 | 단검과 실루엣이 겹칠 위험. 광역은 3연속 일치로 대체 가능 |

### 5.2 1차 검증 결과 (2026-07-29)

첫 레퍼런스 이미지에서 릴에 나온 5종 — 단검 · 후프 · 솜사탕 · 조커 · 풍선 — 은 실루엣이 확실히 구분됐다. 5종만으로도 화면이 충분히 다양해 보였으므로 **6종 상한 가설이 유효하다.** 대포는 아직 검증되지 않았고 단검과 겹칠 위험이 남아 있다.

---

## 6. 보스 — 링마스터

```
[공통 스타일 블록]

A boss character standing centre stage, vertical 3:4 canvas.

A tall imposing RINGMASTER seen head-on: a very tall black top hat, a
long crimson tailcoat with heavy gold frogging and epaulettes, white
gloves, a coiled whip in one hand, a cane in the other. His face is in
shadow under the hat brim with only a wide pale grin visible.

Behind and above him, mounted on the stage back wall, a LARGE ORNATE
WHEEL divided into three square windows in a row, framed in tarnished
gold with small light bulbs around the rim. Two of the three windows are
lit, the third is dark.

He stands in a hard circle of spotlight. The rest of the stage falls into
deep shadow. Torn curtain edges frame the left and right.

Menacing, theatrical, larger than a normal performer.

--ar 3:4 --no text, letters, numbers, health bar, UI, watermark, gore,
blood, photorealism, 3d render
```

---

## 7. 객석 관객 — 2상태

관중 게이지를 대체하는 요소이므로 **앉은 상태와 기립 상태 두 장**이 필요하다.

```
[공통 스타일 블록]

A wide horizontal strip showing a theatre audience from behind, seen as
dark silhouettes against warm stage light, 4:1 canvas.

TOP HALF of the image: the audience SEATED. Rows of dark rounded heads
and shoulders, still, evenly spaced, low profile.

BOTTOM HALF of the image: the SAME audience STANDING and cheering. Arms
raised, hats thrown in the air, bodies at different heights, lively
irregular outline.

Both rows use the same silhouette style so they can be swapped in place.
Silhouettes only, no facial detail. Warm rim light along the tops of the
heads.

--ar 4:1 --no text, letters, numbers, faces, detail, watermark,
photorealism, 3d render
```

---

## 8. 상점 — 매표소

```
[공통 스타일 블록]

A circus ticket booth interior seen head-on, vertical 3:4 canvas.

An ornate wooden booth with a small arched window, gold trim, and a
striped awning above. Behind the counter, a hunched vendor in a striped
waistcoat and a small paper hat, face hidden in shadow, one long hand
resting on the counter.

On the wall behind, rows of small pegs and hooks holding hanging trinkets
and paper tickets. On the counter, a brass cash drawer, a stack of
tickets, and a set of three small empty display slots in a row.

Warm lamp above the window casting light down onto the counter, the rest
of the booth in deep shadow.

Inviting but slightly untrustworthy.

--ar 3:4 --no text, letters, numbers, prices, UI, watermark,
photorealism, 3d render
```

---

## 9. 맵 — 공연 순서표

```
[공통 스타일 블록]

A vintage circus programme poster pinned to a wall, vertical 3:4 canvas.

Aged cream paper with torn edges and a coffee-coloured stain, held by two
brass pins. Printed on it: an ornate border of stars and scrollwork, and
a vertical chain of small circular medallion slots connected by dotted
lines that branch and rejoin, running from the bottom of the poster to
the top. About seven rows of medallions. The medallions are EMPTY circles.

At the top of the chain, a larger medallion with a heavier gold frame.

Behind the poster, a dark canvas tent wall.

--ar 3:4 --no text, letters, numbers, words, titles, watermark,
photorealism, 3d render
```

---

## 10. 주의사항

- **배경 판과 UI 판을 따로 뽑을 것.** 이게 가장 중요한 교훈이다. 한 장에 다 담으려 하면 둘 중 하나가 죽는다
  - **배경 판**(§2.4 계열): 글자·UI 금지. 분위기·원근·조명·팔레트 확인용
  - **UI 판**(§2.3): 글자·숫자·바·버튼 **허용.** 깨진 글자는 무시하고 UI 덩어리의 위치와 밝기만 본다
- 최종 UI 텍스트와 바는 Unity에서 렌더한다. 레퍼런스는 배치와 밝기 배분을 정하기 위한 것이다
- **심볼 칸은 비워둘 것.** §4 슬롯 패널에서 칸에 체리·세븐 같은 게 그려지면 우리 심볼과 충돌한다
- 레퍼런스는 **분위기·비율·실루엣 확인용**이다. 최종 아트는 코드로 생성하는 픽셀 스프라이트이므로, 이 이미지를 그대로 쓰는 게 아니라 **여기서 팔레트와 형태를 추출**한다
- 여러 장 뽑아서 §5.1 검증을 통과한 조합을 고른다. 특히 심볼은 **한 번에 끝나지 않는다**
