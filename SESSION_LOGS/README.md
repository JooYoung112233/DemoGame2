# 세션 기록 보관소

이 폴더는 Codex와 작업하며 확정한 내용과 생성한 시각 자료를 GitHub에 남기기 위한 공간입니다.

## 구조

- `sessions/` — 날짜별 대화 요약, 결정 사항, 다음 할 일
- `images/` — 대화에서 만든 이미지, 스크린샷, 참고 이미지
- `templates/` — 새 세션 기록에 쓰는 양식

대화 전문은 Codex 앱에서 자동으로 파일로 내보낼 수 없으므로, 핵심 결정과 작업 결과를 `sessions/`의 Markdown으로 요약해 보관합니다. 이미지 파일은 `images/`에 복사한 뒤 해당 세션 문서에서 상대 경로로 연결하세요.

## 일반 흐름

```powershell
# 1) 새 세션 기록 만들기
.\scripts\new-session-log.ps1 -Title "전투 UI 수정"

# 2) 이미지 또는 산출물을 SESSION_LOGS\images\에 넣고 세션 문서에 기록

# 3) 기록과 지정한 파일을 커밋 후 push
.\scripts\publish-session.ps1 -Message "docs: record combat UI session"
```

이미지가 50MB 이상이면 일반 Git 대신 Git LFS 사용을 권장합니다. Git LFS를 설정한 뒤 해당 형식을 추적하세요. 예: `git lfs track "*.psd"`.
