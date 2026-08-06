# 캐릭터 UI 아트 규칙

## 캐릭터 순서

1. `director` — 연출가
2. `mirror-actor` — 거울의 배우
3. `maestro` — 악장
4. `frenzied-director` — 광란의 감독
5. `jester` — 어릿광대
6. `corrupted-director` — 타락한 감독
7. `audience-darling` — 관객의 총아
8. `final-act-actor` — 종막의 배우

## 상태

- 기본 모델: `character-lineup-v2.png`
- 공격 반응: `<character>-attack.png`
- HP 0 그로기: `<character>-groggy.png`
- 상태별 전체 검수: `attack-sheet.png`, `groggy-sheet.png`

## 연속성 불변 규칙

- 모든 상태에서 체형, 머리, 모자, 복장, 포인트 색, 대표 소품과 의자 구조를 유지한다.
- 모자를 벗거나 다른 캐릭터의 소품을 들지 않는다.
- 공격 반응은 착석 상태에서 상체·어깨·머리·한쪽 팔만 짧게 움직인다.
- 팔과 손은 각각 두 개이며 몸에 해부학적으로 연결되어야 한다.
- 그로기는 HP 0 상태지만 사망 연출은 아니다. 캐릭터 성격에 맞춰 무너지는 방향만 다르게 한다.
- 런타임 개별 이미지는 투명 `512x512` PNG이며 동일한 피벗과 표시 크기를 사용한다.
