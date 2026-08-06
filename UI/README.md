# UI 작업 폴더

| 경로 | 용도 |
|---|---|
| `combat/references/` | 전투 화면 전체 구성 및 단계별 레퍼런스 |
| `stages/references/` | 무대 배경과 커튼 전환 레퍼런스 |
| `scripts/base/source/` | 대본 베이스 고해상도 원본과 탐색안 |
| `scripts/base/runtime/` | 게임 적용용 384px 대본 베이스 |
| `scripts/examples/` | 텍스트·아이콘·효과가 합성된 사용 예제 |
| `scripts/illustrations/concepts/` | 대본 중앙 연출 삽화 탐색 시트 |
| `icons/combat/` | 피해·방어·환호 등 전투 수치 아이콘 |
| `icons/resources/` | 코스트 등 자원 표시 UI |
| `specs/` | 실제 표시 크기와 제작 규격 |

대본은 `base/runtime`의 재질 베이스와 런타임 콘텐츠 레이어를 분리해서 사용한다. 계열 색, 제목, 요구 심볼, 연출 삽화, 효과 수치만 교체하며 코스트별 두께는 베이스 이미지로 구분한다.

아이콘 폴더의 `source/`에는 생성 원본과 투명 고해상도본을, `runtime/`에는 게임 적용용 축소 PNG를 둔다. 코스트 보석에는 숫자를 굽지 않고 런타임 텍스트로 1~10을 합성한다.
