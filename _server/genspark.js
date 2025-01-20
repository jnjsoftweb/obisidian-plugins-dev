import TurndownService from 'turndown';
import { JSDOM } from 'jsdom';

import { Chrome, sleepAsync, saveJson, Cheerio } from 'jnj-utils';
import { chromeOptions, selectors, defaultEmail } from './settings.js';

// * markdown
// 이스케이프된 대괄호를 정상적인 대괄호로 변환
const unescapeBrackets = (markdown) => {
  return markdown.replace(/\\\[/g, '[').replace(/\\\]/g, ']');
};

const createGensparkTurndownService = () => {
  const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
  });

  // button 태그 제거 규칙
  turndownService.addRule('button', {
    filter: 'button',
    replacement: () => '',
  });

  // pre 태그 처리 규칙
  turndownService.addRule('pre', {
    filter: ['pre'],
    replacement: (content, node) => {
      const codeElement = node.querySelector('code');
      if (!codeElement) return '';

      const language = codeElement.className?.match(/language-(\w+)/)?.[1] || '';
      const code = codeElement.textContent.trim();
      return `\n\`\`\`${language}\n${code}\n\`\`\`\n\n`;
    },
  });

  // inline code 처리
  turndownService.addRule('code', {
    filter: (node) => node.nodeName === 'CODE' && !node.parentNode.matches('pre'),
    replacement: (content) => `\`${content}\``,
  });

  return turndownService;
};

const convertGensparkHtmlToMarkdown = (html) => {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const turndownService = createGensparkTurndownService();

  let markdownContent = '';

  // 메시지 쌍을 찾습니다
  const messages = doc.querySelectorAll('div[data-v-6a624014]');

  messages.forEach((message) => {
    const userMessage = message.querySelector('.user-message');
    const assistantMessage = message.querySelector('.assistant-message');

    if (userMessage) {
      markdownContent += '## user prompt\n\n';
      const userContent = userMessage.innerHTML;
      const userMarkdown = turndownService
        .turndown(userContent)
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/```/g, '~~~')
        .split('\n')
        .map((line) => line.trim())
        .join('\n');

      if (!userMarkdown.includes('~~~')) {
        markdownContent += '~~~\n' + userMarkdown + '\n~~~\n\n';
      } else {
        markdownContent += userMarkdown + '\n\n';
      }
    }

    if (assistantMessage) {
      markdownContent += '## assistant says\n\n';
      markdownContent += turndownService.turndown(assistantMessage.innerHTML) + '\n\n';
    }

    markdownContent += '---\n\n';
  });

  return unescapeBrackets(markdownContent);
};

// * fetch
const fetchFromGenspark = async (source, email = defaultEmail) => {
  chromeOptions.default.email = email;
  const chrome = new Chrome({
    ...chromeOptions.default,
    arguments: [
      '--disable-gpu',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled', // 자동화 감지 비활성화
      '--disable-extensions', // 확장 프로그램 비활성화
      '--start-maximized', // 창 최대화
      '--window-size=1920,1080', // 기본 창 크기 설정
      '--disable-web-security', // CORS 관련 보안 비활성화
      '--allow-running-insecure-content', // 안전하지 않은 컨텐츠 허용
    ],
  });

  try {
    // 목표 URL로 이동
    await chrome.goto(source);

    // 페이지 로딩 대기 시간 증가
    await chrome.driver.sleep(5000);

    // 로그인 상태 확인
    const isLoggedIn = await chrome.driver.executeScript(() => {
      return document.querySelector('.index-layout-content') !== null;
    });

    if (!isLoggedIn) {
      console.log('로그인이 필요합니다. 수동으로 로그인해주세요.');
      await chrome.driver.sleep(50000); // 수동 로그인을 위한 대기
    }

    await chrome.getFullSize();

    // 페이지 소스 가져오기
    const html = await chrome.driver.getPageSource();

    const cheerio = new Cheerio(html);
    const title = cheerio.value('head title');
    const content = cheerio.outerHtml('.index-layout-content');
    let markdown = `---\ntitle: ${title}\nemail: ${email}\nsource: ${source}\n---\n\n`;
    markdown += convertGensparkHtmlToMarkdown(content);

    return { title, content, markdown };
  } finally {
    await chrome.close();
  }
};

export { fetchFromGenspark };
