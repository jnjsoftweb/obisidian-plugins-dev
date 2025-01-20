import TurndownService from 'turndown';
import { JSDOM } from 'jsdom';

import { Chrome, sleepAsync, saveJson, Cheerio } from 'jnj-utils';
import { chromeOptions, selectors, defaultEmail } from './settings.js';

// * markdown
// 이스케이프된 대괄호를 정상적인 대괄호로 변환
const unescapeBrackets = (markdown) => {
  return markdown.replace(/\\\[/g, '[').replace(/\\\]/g, ']');
};

const createClaudeTurndownService = () => {
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
      // pre > div > div[1] 요소의 텍스트 무시
      const languageDiv = node.querySelector('div > div:first-child');
      if (languageDiv) {
        languageDiv.remove();
      }

      const language = node.querySelector('code')?.className?.match(/language-(\w+)/)?.[1] || '';
      const code = node.querySelector('code')?.textContent?.trim() || '';
      return `\n\`\`\`${language}\n${code}\n\`\`\`\n\n`;
    },
  });

  // code 태그 처리 규칙 (userMessage 용)
  turndownService.addRule('code-user-message', {
    filter: (node) => node.parentNode.closest('[data-testid="user-message"]') && node.nodeName === 'CODE',
    replacement: (content, node) => {
      let codeContent = '';
      node.childNodes.forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          codeContent += child.textContent;
        } else if (child.nodeName === 'SPAN') {
          codeContent += child.textContent + '\n';
        }
      });
      return `\n\`\`\`\n${codeContent.trim()}\n\`\`\`\n\n`;
    },
  });

  // p 태그 처리 규칙 (userMessage 용)
  turndownService.addRule('p-user-message', {
    filter: (node) => node.parentNode.closest('[data-testid="user-message"]') && node.nodeName === 'P',
    replacement: (content) => {
      content = content.replace(/<a[^>]*>|<\/a>/g, '');
      return content + '\n\n';
    },
  });

  return turndownService;
};

const convertClaudeHtmlToMarkdown = (html) => {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const turndownService = createClaudeTurndownService();

  let markdownContent = '';

  // 선택자 수정
  const userMessages = doc.querySelectorAll('[data-testid="user-message"]');
  const claudeResponses = doc.querySelectorAll('[data-test-render-count]');

  // 메시지 쌍 처리
  for (let i = 0; i < userMessages.length; i++) {
    markdownContent += '## user prompt\n\n';
    markdownContent += processUserMessage(userMessages[i]);
    markdownContent += '## claude says\n\n';

    // Claude 응답 찾기 - 현재 user message 다음에 오는 응답
    let claudeResponse = userMessages[i]
      .closest('[data-test-render-count]')
      ?.nextElementSibling?.querySelector('[data-test-render-count]');

    if (claudeResponse) {
      markdownContent += `${turndownService.turndown(claudeResponse.innerHTML)}\n\n`;
    } else {
      markdownContent += '답변 없음\n\n';
    }

    markdownContent += '---\n\n';
  }

  return unescapeBrackets(markdownContent);
};

const processUserMessage = (userMessageNode) => {
  let markdown = '';
  const children = userMessageNode.children;

  for (let child of children) {
    if (child.nodeName === 'P') {
      let pContent = child.textContent.replace(/<a[^>]*>|<\/a>/g, '');
      markdown += '~~~\n' + pContent + '\n~~~\n\n';
    } else if (child.nodeName === 'CODE') {
      let codeContent = '';
      child.childNodes.forEach((codeChild) => {
        if (codeChild.nodeType === Node.TEXT_NODE) {
          codeContent += codeChild.textContent;
        } else if (codeChild.nodeName === 'SPAN') {
          codeContent += codeChild.textContent + '\n';
        }
      });
      markdown += `\n\`\`\`\n${codeContent.trim()}\n\`\`\`\n\n`;
    }
  }
  return markdown;
};

// * fetch
const fetchFromClaude = async (source, email = defaultEmail) => {
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
      return document.querySelector('[data-testid="user-message"]') !== null;
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
    const content = cheerio.outerHtml('div.flex-1.overflow-hidden');
    let markdown = `---\ntitle: ${title}\nemail: ${email}\nsource: ${source}\n---\n\n`;
    markdown += convertClaudeHtmlToMarkdown(content);

    return { title, content, markdown };
  } finally {
    await chrome.close();
  }
};

export { fetchFromClaude };
