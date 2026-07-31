# 적군 애니메이션 작업 기록

이 문서는 다른 PC, 새 작업공간, 새 대화에서도 현재 작업을 이어갈 수 있도록 누적 관리한다. 새 이미지 생성·수정 시 아래 항목을 반드시 추가한다.

## 이어서 작업할 때 먼저 읽을 파일

1. `enemy_animation/ENEMY_ANIMATION_RULES.md`
2. `enemy_animation/WORKLOG.md`
3. `ART_PROMPTS.md`의 캐릭터 스프라이트 항목
4. `DESIGN.md`의 캐릭터 애니메이션 방침

## 폴더 역할

- `레퍼런스/`: 게임 화면과 캐릭터 외형의 기준 이미지
- `enemy_animation/2d/source/`: AI 생성 원본과 수정 전 원본
- `enemy_animation/2d/previews/`: 확인용 PNG와 GIF
- `enemy_animation/2d/approved/`: 앵커와 형태 검수를 통과한 개별 프레임
- `enemy_animation/2d/rejected/`: 실패 이유가 기록된 제외 자료
- `enemy_animation/2d/exports/`: 게임에서 바로 사용할 최종 프레임과 시트
- `enemy_animation/3d/reference/`: 전체 시점을 한눈에 보는 합본 레퍼런스
- `enemy_animation/3d/input_views/`: 3D 생성 도구에 한 장씩 넣는 개별 시점 이미지
- `enemy_animation/3d/models/`: 생성된 OBJ와 원본 압축 파일

## 현재 핵심 규칙

- 모든 셀은 같은 크기여야 한다.
- 캐릭터와 무기, 이펙트는 인접 셀을 침범하면 안 된다.
- 공격 애니메이션은 좌측 뒷발 접지점을 동일 좌표에 고정한다.
- idle 애니메이션은 양발과 전체 체형을 고정하고 상체·어깨·손·옷깃만 미세하게 움직인다.
- AI 생성본은 자동으로 `approved` 처리하지 않는다. 정렬 및 형태 검수가 필요하다.
- 원본 파일은 덮어쓰지 않고 새 버전 파일로 저장한다.

## 작업 이력

### 2026-07-31 — 제작 규칙과 폴더 구조 생성

- `enemy_animation/ENEMY_ANIMATION_RULES.md` 작성
- `source`, `approved`, `rejected`, `exports` 폴더 구성
- 광대 단검 공격을 첫 제작 대상으로 확정
- 공격 프레임의 좌측 뒷발 접지점 고정 규칙 확정

### 2026-07-31 — 광대 공격 시트 간격 보정

- 목적: 네 공격 자세가 서로 겹치거나 인접 프레임을 침범하지 않도록 재배치
- 원본: 대화에 첨부된 광대 공격 4프레임 이미지
- 결과: `enemy_animation/2d/source/clown_attack_spaced_v2.png`
- 추가 가공본: `enemy_animation/2d/previews/clown_attack_spaced_v2_4f_513x431.png`
- 구성: 가로 4프레임
- 상태: 생성 원본/가공본. 게임 적용 전 발 앵커와 셀 경계를 추가 검수할 것

### 2026-07-31 — 광대 idle 8프레임 생성

- 외형 레퍼런스: `레퍼런스/레퍼런스.png`의 무대 왼쪽 광대
- 결과: `enemy_animation/2d/source/clown_idle_8f_source.png`
- 구성: 4열 × 2행, 총 8프레임
- 배경: 어두운 자주색
- 의도한 루프: 중립 → 들숨 → 최고점 → 날숨 → 중립
- 고정 대상: 양발, 신발 밑선, 전체 키, 팔다리 길이, 머리 위치
- 가동 대상: 가슴과 어깨 1~2픽셀, 팔과 손의 지연 움직임, 옷깃·소매·머리카락 끝의 미세 움직임
- 상태: `source`. 각 셀 분리 후 픽셀 단위 앵커 및 실제 프레임 차이를 검수해야 함

### 2026-07-31 — 광대 피격 4프레임 생성

- 요청: 광대가 공격에 맞았을 때의 짧은 피격 애니메이션
- 외형 레퍼런스: `레퍼런스/레퍼런스.png`의 무대 왼쪽 광대
- 추가 외형 기준: `enemy_animation/2d/source/clown_idle_8f_source.png`
- 결과: `enemy_animation/2d/source/clown_hit_4f_source.png`
- 구성: 가로 1행, 총 4프레임
- 프레임 흐름: 중립 → 초기 충격 → 최대 움찔 → 회복
- 앵커 의도: 좌측 뒷발의 신발 밑 접지점을 동일한 로컬 좌표에 고정
- 변형 의도: 무릎, 골반, 상체, 어깨, 팔, 옷깃과 머리카락으로 충격을 표현
- 제외 요소: 피, 상처, 공격자, 무기, 충격 섬광, 별 모양, 속도선
- 상태: `source`. 셀 분리 후 좌측 뒷발 앵커와 캐릭터 높이의 픽셀 단위 검수가 필요함
- 다음 작업: 4개 셀을 분리하고 앵커를 정렬한 뒤 통과본을 `2d/approved/`에 저장

### 2026-07-31 — 광대 3D 재구성용 멀티뷰 생성

- 요청: 이미지 기반 3D 생성 도구에 입력할 광대 멀티뷰 구성
- 배치 레퍼런스: Codex 클립보드로 첨부된 잠수정 멀티뷰 예시
- 외형 레퍼런스: `레퍼런스/레퍼런스.png`의 무대 왼쪽 광대
- 추가 외형 기준: `enemy_animation/2d/source/clown_idle_8f_source.png`
- 결과: `enemy_animation/3d/reference/clown_multiview_3d_source_v1.png`
- 포함 시점: 정면, 후면, 좌측면, 우측면, 좌측 45도, 우측 45도, 상단, 하단
- 중앙 기준상: 정면 3/4 시점의 큰 중립 A-포즈
- 표현 방식: 픽셀아트 외형을 유지한 세부적인 스타일라이즈드 3D 콘셉트 렌더
- 고정 요소: 신체 비율, 회색 뾰족모자, 흰 얼굴, 검은 눈, 붉은 코와 머리카락, 버건디 옷깃, 회색·뼈색 줄무늬 의상, 단추 3개, 말린 붉은 신발
- 목적: 단일 이미지보다 형상 추정이 안정적인 다중 시점 입력 제공
- 상태: `3d/reference` 생성 원본. 실제 3D 도구 입력 전 각 시점의 얼굴, 줄무늬, 신발 방향과 비율 일치 여부를 확인할 것
- 전달 방식 수정: 합본은 전체 시점 확인용 레이아웃 레퍼런스로만 사용한다. 실제 3D 생성 도구에는 `enemy_animation/3d/input_views/`의 개별 이미지를 한 장씩 입력한다.
- 개별 입력본: `clown_front.png`, `clown_back.png`, `clown_left.png`, `clown_right.png`, `clown_left_45.png`, `clown_right_45.png`, `clown_top.png`, `clown_bottom.png`, `clown_front_3q.png`
- 개별 입력본 규격: 각각 1024×1024, 라벨과 연결선 제외, 동일 계열의 어두운 중립 배경

## 다음 작업

1. `clown_idle_8f_source.png`를 동일한 8개 셀로 분리한다.
2. 각 프레임의 발바닥 기준선과 양발 좌표를 비교한다.
3. 전체 캐릭터 이동이나 크기 변화가 있으면 수동 정렬한다.
4. 실제 움직임이 너무 작거나 동일한 프레임은 필요한 픽셀만 수정한다.
5. 통과한 개별 프레임을 `2d/approved/`에 넣는다.
6. 투명 배경 또는 게임용 최종 시트를 `2d/exports/`에 만든다.

### 2026-07-31 — 프로젝트 폴더 구조 정리

- 2D 생성 원본을 `enemy_animation/2d/source/`로 이동
- 확인용 PNG와 GIF를 `enemy_animation/2d/previews/`로 이동
- 승인·실패·최종 출력 폴더를 `enemy_animation/2d/` 아래로 통합
- 3D 합본 레퍼런스, 개별 입력 이미지, 모델 파일을 `enemy_animation/3d/` 아래로 분리
- 해시 이름의 OBJ와 ZIP을 `clown_model_v1.obj`, `clown_model_v1_source.zip`으로 변경
- 기존 빈 폴더만 제거했으며 이미지·모델 파일은 삭제하지 않음

## 새 작업 기록 템플릿

```md
### YYYY-MM-DD — 작업 제목

- 요청:
- 입력 레퍼런스:
- 사용한 규칙/핵심 프롬프트:
- 생성 또는 수정 결과:
- 저장 경로:
- 검수 결과:
- 남은 문제:
- 다음 작업:
```
