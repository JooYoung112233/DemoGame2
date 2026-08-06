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
| `hud/hp/` | HP 프레임·하트·충전 텍스처·검수 이미지 |
| `hud/cost/` | 코스트 프레임·가면·소켓 상태·검수 이미지 |
| `slots/prop/concepts/` | 슬롯 하우징 전체 외형 탐색안 |
| `slots/motion/concepts/` | 릴 회전·감속·확장 동작 설계 시트 |
| `slots/runtime/` | 게임에서 합성하는 투명 슬롯 하우징과 상태 오버레이 |
| `slots/source/` | 슬롯 하우징 생성 원본과 크로마키 중간 파일 |
| `slots/reels/runtime/` | 심볼 뒤에서 Y축 순환하는 빈 릴 벨트 타일 |
| `slots/reels/source/` | 릴 벨트 생성 원본 |
| `slots/symbols/runtime/` | 릴 벨트에 배치하는 개별 투명 심볼 PNG |
| `slots/symbols/sheets/` | 심볼 묶음 원본과 검수용 시트 |
| `slots/previews/` | 프레임·릴·심볼의 런타임 합성 검수 이미지 |
| `theater/` | 무대·커튼·관객·감독석 뎁스 레이어와 전환 규격 |
| `specs/` | 실제 표시 크기와 제작 규격 |

대본은 `base/runtime`의 재질 베이스와 런타임 콘텐츠 레이어를 분리해서 사용한다. 계열 색, 제목, 요구 심볼, 연출 삽화, 효과 수치만 교체하며 코스트별 두께는 베이스 이미지로 구분한다.

아이콘 폴더의 `source/`에는 생성 원본과 투명 고해상도본을, `runtime/`에는 게임 적용용 축소 PNG를 둔다. 코스트 보석에는 숫자를 굽지 않고 런타임 텍스트로 1~10을 합성한다.
