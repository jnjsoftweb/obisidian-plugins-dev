---
title: Genspark - Accessing YouTube Subtitles via API
email: bigwhitekmc@gmail.com
source: https://www.genspark.ai/agents?id=ca74f391-0f6a-4c04-b615-7f05c54903c1
tags:
  - aichat/genspark---

## user prompt

~~~
유튜브 자막을 'https://www.youtube.com/api/timedtext' 에서 요청해서 얻을 수 있나요?
~~~

## assistant says

YouTube API를 통한 자막 요청에 대해 설명해드리겠습니다.

**YouTube 자막 API 접근:** 현재 'youtube.com/api/timedtext' 엔드포인트를 직접 사용하는 것은 권장되지 않습니다. 대신 공식 YouTube Data API v3를 사용하는 것이 좋습니다.

**권장되는 자막 가져오기 방법:**

1.  YouTube Data API v3 사용

```python
Copyfrom googleapiclient.discovery import build

def get_captions(video_id, api_key):
    youtube = build('youtube', 'v3', developerKey=api_key)
    captions = youtube.captions().list(
        part='snippet',
        videoId=video_id
    ).execute()
    return captions
```

2.  타사 라이브러리 활용

```python
Copyfrom youtube_transcript_api import YouTubeTranscriptApi

def get_transcript(video_id):
    transcript = YouTubeTranscriptApi.get_transcript(video_id)
    return transcript
```

**주의사항:**

*   YouTube Data API를 사용하려면 Google Cloud Console에서 API 키를 발급받아야 합니다
*   API 사용량 제한이 있으므로 주의가 필요합니다
*   모든 동영상에 자막이 있는 것은 아닙니다
*   일부 자막은 저작권 보호로 인해 접근이 제한될 수 있습니다

youtube-transcript-api 라이브러리를 사용하는 것이 가장 간단하고 효과적인 방법입니다. 이 라이브러리는 별도의 API 키 없이도 공개된 자막을 가져올 수 있습니다.

---

## user prompt

~~~
api_key 없이 유튜브 자막을 얻어올 수 있나요?
~~~

## assistant says

네, API 키 없이도 YouTube 자막을 가져올 수 있는 몇 가지 방법이 있습니다.

**1. youtube-transcript-api 사용:** 가장 간단하고 권장되는 방법입니다.

```python
Copyfrom youtube_transcript_api import YouTubeTranscriptApi

# 단일 비디오 자막 가져오기
def get_transcript(video_id):
    try:
        transcript = YouTubeTranscriptApi.get_transcript(video_id)
        return transcript
    except Exception as e:
        print(f"Error: {e}")
        return None

# 여러 언어의 자막 목록 확인
def get_available_transcripts(video_id):
    try:
        transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
        return transcript_list
    except Exception as e:
        print(f"Error: {e}")
        return None
```

**2. yt-dlp 라이브러리 사용:** 동영상 다운로드 도구이지만 자막도 추출할 수 있습니다.

```python
Copyimport yt_dlp

def get_subtitles(video_url):
    ydl_opts = {
        'writesubtitles': True,
        'writeautomaticsub': True,
        'skip_download': True,  # 비디오는 다운로드하지 않음
    }
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            info = ydl.extract_info(video_url, download=False)
            return info.get('subtitles', {})
        except Exception as e:
            print(f"Error: {e}")
            return None
```

**주의사항:**

*   모든 동영상에 자막이 있는 것은 아닙니다
*   자동 생성된 자막의 경우 정확도가 떨어질 수 있습니다
*   일부 자막은 저작권 등의 이유로 접근이 제한될 수 있습니다
*   과도한 요청은 YouTube의 일시적인 차단을 받을 수 있습니다

**사용 예시:**

```python
Copy# youtube-transcript-api 사용 예시
video_id = "VIDEO_ID_HERE"
transcript = get_transcript(video_id)
for entry in transcript:
    print(f"Time: {entry['start']}, Text: {entry['text']}")

# yt-dlp 사용 예시
video_url = "https://www.youtube.com/watch?v=VIDEO_ID_HERE"
subtitles = get_subtitles(video_url)
```

이러한 방법들은 API 키 없이도 작동하며, 대부분의 공개된 YouTube 비디오의 자막을 추출할 수 있습니다.

---

## user prompt

~~~
chrome extension에서 사용하려면 어떻게 하나요?
~~~

## assistant says

Chrome Extension에서 YouTube 자막을 가져오는 방법을 설명해드리겠습니다.

**1. manifest.json 설정:**

```json
Copy{
  "manifest_version": 3,
  "name": "YouTube Subtitle Extractor",
  "version": "1.0",
  "permissions": [
    "activeTab",
    "scripting"
  ],
  "host_permissions": [
    "https://www.youtube.com/*"
  ],
  "content_scripts": [
    {
      "matches": ["https://www.youtube.com/*"],
      "js": ["content.js"]
    }
  ]
}
```

**2. content.js에서 자막 추출:** YouTube 페이지에서 직접 자막 데이터를 가져오는 방법입니다.

```javascript
Copy// 방법 1: 페이지 내 자막 트랙 확인
function getSubtitlesFromPlayer() {
    const player = document.querySelector('.html5-video-player');
    if (!player) return null;
    
    const tracks = player.getElementsByTagName('track');
    return Array.from(tracks).map(track => track.src);
}

// 방법 2: YouTube 플레이어의 내부 데이터 활용
function getSubtitlesFromYouTubePlayer() {
    if (typeof window.ytplayer === 'undefined') return null;
    
    const playerData = window.ytplayer.config;
    if (playerData && playerData.captions) {
        return playerData.captions;
    }
    return null;
}

// 방법 3: 네트워크 요청을 통한 자막 가져오기
async function fetchSubtitles(videoId, lang = 'en') {
    try {
        const response = await fetch(`https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}`);
        const data = await response.text();
        return data;
    } catch (error) {
        console.error('Error fetching subtitles:', error);
        return null;
    }
}
```

**3. 이벤트 리스너 설정:**

```javascript
Copy// content.js
function extractVideoId(url) {
    const urlParams = new URLSearchParams(new URL(url).search);
    return urlParams.get('v');
}

// 페이지 로드 완료 후 실행
document.addEventListener('yt-navigate-finish', async function() {
    const videoId = extractVideoId(window.location.href);
    if (videoId) {
        // 자막 데이터 가져오기
        const subtitles = await fetchSubtitles(videoId);
        if (subtitles) {
            // 자막 처리 로직
            console.log('Subtitles:', subtitles);
        }
    }
});
```

**4. 사용자 인터페이스 추가 (선택사항):**

```javascript
Copy// 버튼을 YouTube 플레이어 컨트롤에 추가
function addSubtitleButton() {
    const controls = document.querySelector('.ytp-right-controls');
    if (!controls) return;

    const button = document.createElement('button');
    button.className = 'ytp-button subtitle-button';
    button.innerHTML = 'CC';
    button.onclick = async () => {
        const videoId = extractVideoId(window.location.href);
        const subtitles = await fetchSubtitles(videoId);
        // 자막 표시 로직
    };

    controls.appendChild(button);
}

// 스타일 추가
const style = document.createElement('style');
style.textContent = `
    .subtitle-button {
        cursor: pointer;
        padding: 0 8px;
    }
`;
document.head.appendChild(style);
```

**주의사항:**

*   YouTube의 페이지 구조가 변경될 수 있으므로, 선택자를 주기적으로 업데이트해야 할 수 있습니다
*   과도한 요청은 YouTube의 제한을 받을 수 있습니다
*   일부 동영상은 자막이 없거나 접근이 제한될 수 있습니다

**개선 사항:**

```javascript
Copy// 자막 캐싱
const subtitleCache = new Map();

async function getCachedSubtitles(videoId) {
    if (subtitleCache.has(videoId)) {
        return subtitleCache.get(videoId);
    }
    
    const subtitles = await fetchSubtitles(videoId);
    subtitleCache.set(videoId, subtitles);
    return subtitles;
}

// 에러 처리
function handleError(error) {
    console.error('Subtitle extraction error:', error);
    // 사용자에게 에러 메시지 표시
}
```

이 코드들을 기반으로 필요에 따라 확장 프로그램의 기능을 추가하거나 수정할 수 있습니다.

---

