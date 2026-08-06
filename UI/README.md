# UI 작업 폴더

| 경로 | 용도 |
|---|---|
| `combat/references/` | 전투 화면 전체 구성 및 단계별 레퍼런스 |
| `stages/references/` | 무대 배경과 커튼 전환 레퍼런스 |
| `scripts/base/source/` | 대본 베이스 고해상도 원본과 탐색안 |
| `scripts/base/runtime/` | 게임 적용용 384px 대본 베이스 |
| `scripts/examples/` | 텍스트·아이콘·효과가 합성된 사용 예제 |
| `specs/` | 실제 표시 크기와 제작 규격 |

대본은 `base/runtime`의 재질 베이스와 런타임 콘텐츠 레이어를 분리해서 사용한다. 계열 색, 제목, 요구 심볼, 연출 삽화, 효과 수치만 교체하며 코스트별 두께는 베이스 이미지로 구분한다.
