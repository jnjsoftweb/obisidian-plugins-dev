import TurndownService from 'turndown';
import { JSDOM } from 'jsdom';

import { Chrome, sleepAsync, saveJson, Cheerio, loadFile, saveFile } from 'jnj-utils';
import { chromeOptions, selectors, defaultEmail } from './settings.js';

// * markdown
// 이스케이프 문자 제거 함수
const removeEscapes = (markdown) => {
  return markdown.replace(/\\([[\].])/g, '$1'); // \[, \], \. 등의 이스케이프 제거
};

const createPerplexityTurndownService = () => {
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

const convertPerplexityHtmlToMarkdown = (html, { title = '', email = '', source = '' } = {}) => {
  console.log('=== 답변 처리 시작 ===');
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const turndownService = createPerplexityTurndownService();

  // frontmatter 추가
  let markdownContent = '';
  if (title || email || source) {
    markdownContent = `---\ntitle: ${title}\nemail: ${email}\nsource: ${source}\ntags:\n  - aichat/perplexity\n---\n\n`;
  }

  let markdown = '';

  // 채팅 컨테이너 찾기
  const chatContainers = document.querySelectorAll('.col-span-8');
  console.log(`찾은 채팅 컨테이너 수: ${chatContainers.length}`);

  for (const container of chatContainers) {
    console.log('\n=== 채팅 컨테이너 처리 시작 ===');

    // 질문 찾기 (h1 또는 div.break-words)
    const questionDiv = container.querySelector('h1') || container.querySelector('.break-words');
    if (questionDiv) {
      console.log('\n--- 질문 div ---');
      console.log('HTML:', questionDiv.outerHTML);

      const questionText = questionDiv.textContent
        .trim()
        .replace(/쿼리\s*편집$/, '')
        .trim();

      markdownContent += '\n\n# user prompt\n\n';
      markdownContent += '~~~\n' + questionText + '\n~~~\n\n';

      // 답변 찾기 (prose 클래스를 가진 div)
      const answerDiv = container.querySelector('.prose.dark\\:prose-invert');
      if (answerDiv) {
        console.log('\n--- 답변 div ---');
        console.log('HTML:', answerDiv.outerHTML);

        markdownContent += '\n\n# assistant says\n\n';

        // 일반 텍스트와 마크다운 요소 처리
        const processNode = (node) => {
          // 헤딩 처리
          if (node.nodeName.match(/^H[1-6]$/)) {
            const level = node.nodeName[1];
            return `\n\n${'#'.repeat(level)} ${node.textContent.trim()}\n\n`;
          }

          // 코드 블록 처리
          if (node.nodeName === 'PRE') {
            const langDiv = node.querySelector('.text-text-200');
            const language = langDiv ? langDiv.textContent.trim() : '';
            const codeContent = node.querySelector('code')?.textContent?.trim();

            if (codeContent) {
              return `\n\`\`\`${language}\n${codeContent}\n\`\`\`\n`;
            }
            return '';
          }

          // 목록 처리
          if (node.nodeName === 'OL' || node.nodeName === 'UL') {
            return turndownService.turndown(node.outerHTML);
          }

          // 인라인 코드 처리
          if (node.nodeName === 'CODE' && !node.closest('pre')) {
            return `\`${node.textContent}\``;
          }

          // 링크 처리
          if (node.nodeName === 'A') {
            const href = node.getAttribute('href');
            const text = node.textContent.trim();
            // 숫자만 있는 링크는 참조 링크로 처리
            if (/^\d+$/.test(text)) {
              // 이전 노드가 텍스트이고 마침표로 끝나지 않는 경우에만 공백 추가
              const prevNode = node.previousSibling;
              const needsSpace =
                prevNode?.nodeType === dom.window.Node.TEXT_NODE && !/[\s.]$/.test(prevNode.textContent.trim());
              return `${needsSpace ? ' ' : ''}[${text}](${href})`;
            }
            return `[${text}](${href})`;
          }

          // 강조 처리
          if (node.nodeName === 'STRONG' || node.nodeName === 'B') {
            return `**${node.textContent}**`;
          }
          if (node.nodeName === 'EM' || node.nodeName === 'I') {
            return `*${node.textContent}*`;
          }

          // 일반 텍스트 노드
          if (node.nodeType === dom.window.Node.TEXT_NODE) {
            const text = node.textContent;
            // 다음 노드가 링크이고 현재 텍스트가 마침표로 끝나지 않는 경우 공백 제거
            if (node.nextSibling?.nodeName === 'A' && !text.trim().endsWith('.')) {
              return text.replace(/\s+$/, '');
            }
            return text;
          }

          // 다른 노드들은 자식 노드들을 재귀적으로 처리
          let result = '';
          for (const child of node.childNodes) {
            result += processNode(child);
          }

          // div나 p 태그는 앞뒤로 줄바꿈 추가 (불필요한 줄바꿈 제거)
          if (node.nodeName === 'DIV' || node.nodeName === 'P') {
            result = result
              .trim()
              .replace(/\[\s+(\d+)\s+\]/g, '[$1]')
              .replace(/\s+\]/g, ']')
              .replace(/\[\s+/g, '[');
            if (result) result = result + '\n';
          }

          return result;
        };

        // 전체 답변 처리
        markdown += processNode(answerDiv);

        // 연속된 줄바꿈 정리
        markdown = markdown.replace(/\n{3,}/g, '\n\n').trim();

        markdownContent += markdown + '\n\n';
      }

      markdownContent += '---\n\n';
    }
  }

  console.log('=== 답변 처리 종료 ===');

  // 최종 마크다운 문자열 처리
  markdownContent = markdownContent
    // 코드 블록 처리: 앞의 공백 제거하고 \n``` 형식으로 변경
    .replace(/[ \t]*```/gm, '\n```')
    // 링크 앞에 문자가 있는 경우 공백 추가 ([앞에 공백이나 줄바꿈이 아닌 문자가 있는 경우)
    .replace(/([^\s\n])\[/g, '$1 [')
    // 연속된 줄바꿈 정리
    .replace(/\n{3,}/g, '\n\n')
    // 코드 블록 시작 부분의 연속된 줄바꿈 정리
    .replace(/\n\n```/g, '\n```')
    // 코드 블록 외부의 줄 시작과 끝의 공백 제거
    .split(/(?=```[\s\S]*?```)/g) // 코드 블록을 기준으로 분할
    .map((block, index) => {
      if (block.startsWith('```')) {
        // 코드 블록인 경우 그대로 반환
        return block;
      } else {
        // 코드 블록이 아닌 경우 공백 제거
        return block
          .split('\n')
          .map((line) => line.trim())
          .join('\n');
      }
    })
    .join('');

  return markdownContent;
};

// * fetch
const fetchFromPerplexity = async (source, email = defaultEmail) => {
  chromeOptions.default.email = email;
  const chrome = new Chrome({
    ...chromeOptions.default,
    arguments: [
      '--disable-gpu',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--disable-extensions',
      '--start-maximized',
      '--window-size=1920,1080',
      '--disable-web-security',
      '--allow-running-insecure-content',
    ],
  });

  try {
    await chrome.goto(source);
    await chrome.driver.sleep(5000);

    // 페이지 소스 가져오기
    const html = await chrome.driver.getPageSource();
    const cheerio = new Cheerio(html);

    // 제목 정리 - 파일명으로 사용할 수 없는 문자 제거
    const rawTitle = cheerio.value('head title') || 'Untitled';
    const title = rawTitle
      .replace(/[\\/:*?"<>|\n\r]/g, '') // 파일명으로 사용할 수 없는 문자 제거
      .replace(/\s+/g, ' ') // 연속된 공백을 하나로
      .trim();

    // 컨텐츠 선택자 수정
    const content = cheerio.outerHtml('main') || cheerio.outerHtml('body');

    // convertPerplexityHtmlToMarkdown 함수 호출 시 메타데이터 전달
    const markdown = convertPerplexityHtmlToMarkdown(content, {
      title: title.substring(0, 100), // 제목 길이 제한
      email,
      source,
    });

    return {
      title: title.substring(0, 100),
      content,
      markdown,
    };
  } finally {
    await chrome.close();
  }
};

export { fetchFromPerplexity };

const html = loadFile(
  './downloads/perplexity_옵시디언에서 youtube 동영상 재생을 위한 css를 만들어주세요..markdown-preview-view....html'
);
// console.log(html);
const markdown = convertPerplexityHtmlToMarkdown(html, {
  title: 'Test Title',
  email: 'test@example.com',
  source: 'https://test.com',
});
// console.log(markdown);
saveFile('./downloads/perplexity_2.md', markdown);
