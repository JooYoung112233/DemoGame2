# UNDERSTUDY UI FLOW MAP

전체 UI 1차 시안의 버튼 이동과 오버레이 관계를 Figma에 옮기기 위한 기준 문서다.

현재 단계는 `00 FLOW MAP` 검토용이며, 화면 이미지를 새로 그리지 않고 `UI/`에 있는 1920×1080 시안만 사용한다.

## 연결선 규칙

| 표기 | Figma 동작 | 용도 |
|---|---|---|
| 실선 | `Navigate to` | 전체 화면 이동 |
| 점선 | `Open overlay` | 선택창, 상세창, 설정, 확인창 |
| 굵은 복귀선 | `Back` 또는 저장된 복귀 대상 | 지도·전투·이전 화면 복귀 |
| 자동 | `After delay` | 이야기, 막 전환, 결과 연출 |

## 전체 화면 흐름

```mermaid
flowchart LR
    classDef entry fill:#3b2528,color:#f3e3bd,stroke:#b38a4d
    classDef meta fill:#28231f,color:#f3e3bd,stroke:#806d51
    classDef run fill:#2c211f,color:#f3e3bd,stroke:#a45f51
    classDef encounter fill:#242323,color:#f3e3bd,stroke:#756753
    classDef result fill:#30231f,color:#f3e3bd,stroke:#a77c45
    classDef overlay fill:#1d1d1d,color:#f3e3bd,stroke:#777,stroke-dasharray: 5 4

    subgraph E[진입]
        MM[메인 메뉴]
        DS[감독 선택]
        PP[공연 준비]
        ST[이야기 장면]
    end

    subgraph M[극장·메타]
        TR[극장 기록 허브]
        CP[도감]
        SL[대본 서고]
        RS[유물 창고]
        PH[공연 이력]
        RT[복원 목록]
        RE[재연 단계]
    end

    subgraph R[공연 루프]
        MAP[여정 지도]
        CB[전투]
        SH[상점]
        DR[각색실]
        EV[사건·즉흥극]
        DG[분장실]
        AU[오디션]
        RL[유물 보물]
        TG[극단 성장]
    end

    subgraph X[보상·전환·결과]
        RW[공연 보상]
        AT[막 전환]
        VW[승리 정산]
        DF[패배 정산]
        EN[엔딩 이야기]
    end

    subgraph O[공용 오버레이]
        PK[공용 선택창]
        DT[공용 상세창]
        SM[설정]
        CF[공용 확인창]
        CI[전투 정보 패널]
    end

    MM -->|NEW PERFORMANCE| DS
    DS -->|SELECT| PP
    PP -->|BUY THE TICKET| ST
    ST -->|자동·확인 입력| MAP
    MM -->|CONTINUE| MAP

    MM -->|THEATRE RECORDS| TR
    TR --> CP
    TR --> SL
    TR --> RS
    TR --> PH
    MM -->|RESTORATION| RT
    MM -->|REENACTMENT| RE
    RE -->|SELECT STAGE| PP

    MAP -->|공연 노드| CB
    MAP --> SH
    MAP --> DR
    MAP --> EV
    MAP --> DG
    MAP --> AU
    MAP --> RL
    MAP --> TG

    SH ==>|완료·나가기| MAP
    DR ==>|완료·나가기| MAP
    EV ==>|결과·나가기| MAP
    DG ==>|완료·나가기| MAP
    AU ==>|확정·나가기| MAP
    RL ==>|확정·나가기| MAP
    TG ==>|필수 선택 완료| MAP

    CB -->|일반·엘리트 승리| RW
    RW ==>|TAKE · SKIP| MAP
    CB -->|1·2막 보스 승리| TG
    TG -->|보스 성장 완료| AT
    AT -->|자동| MAP
    CB -->|3막 보스 승리| VW
    CB -->|HP 0| DF
    VW -->|자동·계속| EN
    EN -->|RETURN| MM
    DF -->|RETURN TO THE THEATRE| MM

    PP -.->|릴·대본·유물 변경| PK
    SH -.->|내 극단·서비스 대상| PK
    DR -.->|각색 대상| PK
    EV -.->|대상 필요 시| PK
    VW -.->|계승 유물| PK
    RE -.->|이력·퀘스트| PK

    VW -.->|VIEW PERFORMANCE| DT
    DF -.->|VIEW PERFORMANCE| DT
    PH -.->|공연 선택| DT
    RE -.->|재연 기록·퀘스트 상세| DT

    MM -.->|SETTINGS| SM
    CB -.->|ESC| SM
    ST -.->|ESC| SM
    SM -.->|포기·초기화·종료| CF
    CB -.->|대본·적·관객·무대·유품| CI

    class MM,DS,PP,ST entry
    class TR,CP,SL,RS,PH,RT,RE meta
    class MAP,CB run
    class SH,DR,EV,DG,AU,RL,TG encounter
    class RW,AT,VW,DF,EN result
    class PK,DT,SM,CF,CI overlay
```

## Figma 프레임 등록표

`01 FULL SCREENS`에는 아래 파일을 같은 이름의 1920×1080 프레임으로 배치한다.

| Frame ID | 화면 | 기준 이미지 |
|---|---|---|
| `FS-01` | 메인 메뉴 | `main-menu/preview-v3.png` |
| `FS-02` | 감독 선택 | `director-select/preview.png` |
| `FS-03` | 공연 준비 | `performance-prep/preview.png` |
| `FS-04` | 이야기 장면 | `story/preview.png` |
| `FS-05` | 극장 기록 허브 | `theatre-records/preview.png` |
| `FS-06` | 도감 | `compendium/preview.png` |
| `FS-07` | 대본 서고 | `theatre-records/preview-script-library-v2.png` |
| `FS-08` | 유물 창고 | `theatre-records/preview-relic-storage-final.png` |
| `FS-09` | 공연 이력 | `theatre-records/preview-performance-history.png` |
| `FS-10` | 복원 목록 | `restoration/preview-v4.png` |
| `FS-11` | 재연 단계 | `reenactment/preview-v2.png` |
| `FS-12` | 여정 지도 | `map/preview.png` |
| `FS-13` | 전투 | `combat/assembled-existing-ui-preview.png` |
| `FS-14` | 상점 | `shop/preview.png` |
| `FS-15` | 각색실 | `dramaturgy/preview.png` |
| `FS-16` | 사건·즉흥극 | `event/preview.png` |
| `FS-17` | 분장실 | `dressing-room/preview.png` |
| `FS-18` | 오디션 | `audition/preview-v2.png` |
| `FS-19` | 유물 보물 | `relic-treasure/preview-v2.png` |
| `FS-20` | 극단 성장 | `troupe-growth/preview-v4.png` |
| `FS-21` | 막 전환 | `act-transition/preview.png` |
| `FS-22` | 승리 정산 | `run-result/preview-victory-v2.png` |
| `FS-23` | 패배 정산 | `run-result/preview-defeat-v1.png` |

## 오버레이 등록표

`02 COMPONENTS`에서 원본 크기를 유지하고, `03 PROTOTYPE`에서는 호출 화면 위에 중앙 정렬한다.

| Overlay ID | 구성 | 기준 이미지 |
|---|---|---|
| `OV-01` | 공연 보상 | `reward/preview.png` |
| `OV-02` | 공용 선택창 | `overlays/preview-picker-script.png` |
| `OV-03` | 공용 상세창 | `overlays/preview-details-performance-v3.png` |
| `OV-04` | 설정 | `system-menu/preview-settings-audio.png` |
| `OV-05` | 공용 확인창 | `system-menu/preview-confirm-abandon.png` |
| `OV-06` | 전투 상세·상태 | `combat-info/preview-combat-collapsed-default.png` 외 상태 이미지 |
| `OV-07` | 사용 가능 상태 | `overlays/preview-state-availability.png` |
| `OV-08` | 빈 목록·NEW·해금 | `overlays/preview-state-empty-new-unlock.png` |

## 프로토타입 규칙

- 이미지 속 실제 버튼 위에만 투명 핫스팟을 둔다. 화면 전체를 임의의 다음 화면 버튼으로 사용하지 않는다.
- 전체 화면 이동은 `Dissolve 150ms`, 오버레이는 `Instant`, 이야기 전환은 `Dissolve 250ms`로 통일한다.
- `ESC`, `BACK`, `CANCEL`은 직전에 열었던 화면으로 돌아간다.
- 지도에서 열린 노드 화면은 완료 후 항상 같은 지도 프레임으로 복귀한다.
- 전투 정보는 각각 새 전체 프레임을 만들지 않고 전투 프레임 위 오버레이 variant로 연결한다.
- `CONTINUE`는 실제로는 저장된 화면을 복원하지만 프로토타입에서는 여정 지도로 연결한다.
- 막 전환은 클릭 핫스팟 없이 `After delay`로 다음 막 지도에 연결한다.
- 커튼 닫힘 로딩 커버는 모든 화면 사이에 넣지 않고 막 전환과 무대 교체에만 사용한다.

## 이번 검토에서 확인할 것

1. 메인 메뉴에서 `RESTORATION`과 `REENACTMENT`를 직접 노출할지, 극장 기록 허브 아래로 넣을지.
2. 보스 승리 후 `극단 성장 → 막 전환` 순서가 실제 규칙과 맞는지.
3. 승리 정산 뒤 엔딩 이야기를 거쳐 메인으로 가는지, 메인 복귀 후 해금 이야기로 분리할지.

