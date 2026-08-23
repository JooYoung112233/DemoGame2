# 화면 이미지 카탈로그

각 화면의 대표 프리뷰를 빠르게 찾기 위한 목록입니다. 실제 이미지와 화면별 설명은 각 폴더에 그대로 두었고, 게임에서 쓰는 레이어·아이콘·원본 파일은 이 카탈로그에 섞지 않았습니다.

## 시작 · 진행

| 화면 | 대표 프리뷰 | 추가 상태 |
|---|---|---|
| [메인 메뉴](main-menu/README.md) | [preview](main-menu/preview.png) | [v2](main-menu/preview-v2.png), [v3](main-menu/preview-v3.png) |
| [감독 선택](director-select/README.md) | [preview](director-select/preview.png) | — |
| [오디션](audition/README.md) | [preview](audition/preview.png) | [v2](audition/preview-v2.png) |
| [분장실](dressing-room/README.md) | [preview](dressing-room/preview.png) | — |
| [공연 준비](performance-prep/README.md) | [preview](performance-prep/preview.png) | — |
| [여정 지도](map/README.md) | [preview](map/preview.png) | — |
| [사건 · 즉흥극](event/README.md) | [preview](event/preview.png) | — |
| [막 전환](act-transition/README.md) | [preview](act-transition/preview.png) | — |

## 공연 · 전투

| 화면 | 대표 프리뷰 | 추가 상태 |
|---|---|---|
| [전투 화면](combat/README.md) | [조립본](combat/assembled-existing-ui-preview.png) | [구성 참고](combat/references/modern-combat-ui-variable-slots-cost-v8.png) |
| [전투 정보](combat-info/README.md) | [기본](combat-info/preview.png) | [축소](combat-info/preview-combat-collapsed-default.png), [커튼 콜](combat-info/preview-curtain-call.png), [의도·난입](combat-info/preview-intent-intruder-v2.png), [관객 요구](combat-info/preview-audience-demand-cheer.png), [비용 부족](combat-info/preview-insufficient-cost.png), [유품 사용](combat-info/preview-keepsake-use-confirm.png), [진행 변화](combat-info/preview-stage-progress-change.png), [튜토리얼](combat-info/preview-tutorial-one-line.png) |
| [보상](reward/README.md) | [preview](reward/preview.png) | — |
| [공연 결과](run-result/README.md) | [승리](run-result/preview-victory-v2.png) | [승리 v1](run-result/preview-victory-v1.png), [패배](run-result/preview-defeat-v1.png) |

## 성장 · 관리

| 화면 | 대표 프리뷰 | 추가 상태 |
|---|---|---|
| [소품실 · 상점](shop/README.md) | [preview](shop/preview.png) | — |
| [각색실](dramaturgy/README.md) | [preview](dramaturgy/preview.png) | [비활성 상태](dramaturgy/preview-disabled-cover-v1.png) |
| [유물 보물](relic-treasure/README.md) | [preview](relic-treasure/preview.png) | [v2](relic-treasure/preview-v2.png) |
| [극단 성장](troupe-growth/README.md) | [preview](troupe-growth/preview.png) | [v2](troupe-growth/preview-v2.png), [v3](troupe-growth/preview-v3.png), [v4](troupe-growth/preview-v4.png) |
| [복원 목록](restoration/README.md) | [preview](restoration/preview.png) | [v2](restoration/preview-v2.png), [v3](restoration/preview-v3.png), [v4](restoration/preview-v4.png) |
| [재연 · 이력](reenactment/README.md) | [preview](reenactment/preview.png) | [v2](reenactment/preview-v2.png) |
| [극장 기록](theatre-records/README.md) | [preview](theatre-records/preview.png) | [공연 이력](theatre-records/preview-performance-history.png), [유물 보관](theatre-records/preview-relic-storage-final.png), [대본 도서관](theatre-records/preview-script-library-v2.png) |
| [도감](compendium/README.md) | [preview](compendium/preview.png) | — |

## 공통 · 서사

| 화면 | 대표 프리뷰 | 추가 상태 |
|---|---|---|
| [이야기 장면](story/README.md) | [preview](story/preview.png) | — |
| [시스템 메뉴](system-menu/README.md) | [기본](system-menu/preview.png) | [설정](system-menu/preview-settings-audio.png), [포기 확인](system-menu/preview-confirm-abandon.png) |
| [공용 오버레이](overlays/README.md) | [대본 선택](overlays/preview-picker-script.png) | [상세](overlays/preview-details-performance-v3.png), [선택 가능](overlays/preview-state-availability.png), [빈 슬롯·해금](overlays/preview-state-empty-new-unlock.png) |
| [UI 흐름도](flow-map/README.md) | [preview](flow-map/preview.png) | [1920px](flow-map/preview-1920.png) |

## 보관 규칙

- 화면 전체 캡처와 시안은 해당 화면 폴더의 `preview-*.png`로 둡니다.
- 게임에서 바로 사용하는 조각은 `runtime/`, 고해상도·투명 원본은 `source/`, 비교용은 `references/`에 둡니다.
- 새 화면을 추가하면 이 파일에 대표 프리뷰 1개와 상태별 링크를 함께 추가합니다.
