## login

### claude.com 접속시 google 로그인 페이지로 이동

- `jnj-utils` Chrome 사용시


---

```prompt
```

네, Selenium의 설정을 수정하여 수동 접속과 동일하게 만들 수 있습니다. 주요 문제는 자동화된 브라우저 감지를 우회하는 것입니다. 다음과 같이 수정해보겠습니다:

```typescript:jnj-utils/src/web/chrome.ts
// ... existing code ...

class Chrome {
  constructor(
    options: {
      headless?: boolean;
      profileName?: string;
      email?: string;
      userDataDir?: string;
      arguments?: string[];
    } = { headless: false, profileName: '', email: '', userDataDir: '', arguments: [] }
  ) {
    const chromeOptions = new chrome.Options();

    // 기본 옵션 설정
    if (options.headless) {
      chromeOptions.addArguments('--headless=new');  // 새로운 헤드리스 모드 사용
    }
    
    const profileName =
      options.profileName ??
      getProfileByEmail(options.email, options.userDataDir) ??
      null;

    // 프로필 설정
    if (profileName) {
      chromeOptions.addArguments(`--user-data-dir=${options.userDataDir}`);
      chromeOptions.addArguments(`--profile-directory=${profileName}`);
    }

    // 자동화 감지 우회를 위한 기본 인자
    const defaultArguments = [
      '--disable-gpu',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',  // 자동화 감지 비활성화
      '--disable-extensions',  // 확장 프로그램 비활성화
      '--start-maximized',  // 창 최대화
      '--window-size=1920,1080',  // 기본 창 크기 설정
    ];

    // 기본 인자와 사용자 지정 인자를 합치기
    const finalArguments = [...defaultArguments, ...(options.arguments || [])];

    // 최종 인자 설정
    finalArguments.forEach((arg) => chromeOptions.addArguments(arg));

    // 자동화 관련 설정 제거
    chromeOptions.excludeSwitches(['enable-automation']);
    chromeOptions.setUserPreferences({
      'credentials_enable_service': false,
      'profile.password_manager_enabled': false,
      'excludeSwitches': ['enable-automation'],
      'useAutomationExtension': false
    });

    // 드라이버 초기화
    this.driver = new Builder()
      .forBrowser('chrome')
      .setChromeOptions(chromeOptions)
      .build();

    // CDP를 통한 추가 설정
    this.driver.executeScript(`
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined
      });
    `);
  }

  // ... existing code ...
}
```

```javascript:plugins/_server/claude.js
// ... existing code ...

const fetchFromClaude = async (source, email = defaultEmail) => {
  chromeOptions.default.email = email;
  const chrome = new Chrome({
    ...chromeOptions.default,
    arguments: [
      '--disable-web-security',  // CORS 관련 보안 비활성화
      '--allow-running-insecure-content',  // 안전하지 않은 컨텐츠 허용
    ]
  });

  try {
    // 목표 URL로 이동
    await chrome.goto(source);
    
    // 페이지 로딩 대기 시간 증가
    await chrome.driver.sleep(5000);
    
    // 로그인 상태 확인
    const isLoggedIn = await chrome.driver.executeScript(() => {
      return document.querySelector('[data-testid="user-message"]') !== null;
    });

    if (!isLoggedIn) {
      console.log('로그인이 필요합니다. 수동으로 로그인해주세요.');
      await chrome.driver.sleep(50000);  // 수동 로그인을 위한 대기
    }

    await chrome.getFullSize();
    
    // 페이지 소스 가져오기
    const html = await chrome.driver.getPageSource();

    const cheerio = new Cheerio(html);
    const title = cheerio.value('head title');
    const content = cheerio.outerHtml('div.flex-1.overflow-hidden');
    let markdown = `---\ntitle: ${title}\nemail: ${email}\nsource: ${source}\n---\n\n`;
    markdown += convertClaudeHtmlToMarkdown(content);

    return { title, content, markdown };
  } finally {
    await chrome.close();
  }
};

// ... existing code ...
```

주요 변경사항:
1. Chrome 클래스에 자동화 감지 우회를 위한 설정 추가:
   - `--disable-blink-features=AutomationControlled`
   - `excludeSwitches(['enable-automation'])`
   - navigator.webdriver 속성 재정의

2. fetchFromClaude 함수 개선:
   - 추가적인 보안 관련 설정 비활성화
   - 로그인 상태 확인 로직 추가
   - 대기 시간 조정

이러한 변경으로 자동화 감지를 우회하고 수동 접속과 비슷한 환경을 만들 수 있습니다. 그래도 로그인이 안 된다면, 처음 한 번은 수동으로 로그인하고 이후에는 저장된 프로필을 사용하는 방식을 시도해볼 수 있습니다.
