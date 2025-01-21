```sh
cd "D:\Notes\Obsidian\liveSync\dev\.obsidian\plugins" && mkdir youtube-clipper && cd youtube-clipper && npm init -y
```

```
클립보드에 있는 youtube url로 자막, 정보를 가져오는 기능을 잘 작동합니다.

youtube url들이 있는 옵시디언 노트에서 'youtube 목록 전체 저장' 기능을 구현할 수 있나요?
```


새로운 기능을 추가했습니다:
새로운 명령어 추가:
이름: "Save All YouTube Clipper from Current Note"
현재 열려있는 노트에서 모든 YouTube URL을 찾아 자막을 저장합니다
주요 기능:
정규식을 사용하여 노트에서 YouTube URL 추출
각 URL에 대해 순차적으로 자막과 정보를 가져와 저장
진행 상황을 Notice로 표시 (예: "3/10 처리 중...")
API 부하를 줄이기 위해 각 요청 사이에 1초 지연
에러 처리:
URL이 없는 경우 알림
개별 URL 처리 실패 시 다음 URL로 계속 진행
전체 과정의 성공/실패 알림
사용 방법:
옵시디언에서 YouTube URL이 포함된 노트를 엽니다
명령어 팔레트(Ctrl+P)를 열고 "Save All YouTube Clipper" 명령어를 실행합니다
노트에서 발견된 모든 YouTube URL의 자막이 순차적으로 저장됩니다
이제 다시 빌드하고 테스트해보시겠습니까?

