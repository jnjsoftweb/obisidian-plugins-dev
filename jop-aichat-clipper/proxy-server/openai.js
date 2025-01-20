import TurndownService from "turndown";
import { JSDOM } from "jsdom";

import { Chrome, sleepAsync, saveJson, Cheerio } from "jnj-utils";
import { chromeOptions, selectors, defaultEmail } from "./settings.js";

// * markdown
// 이스케이프된 대괄호를 정상적인 대괄호로 변환
const unescapeBrackets = (markdown) => {
  return markdown.replace(/\\\[/g, "[").replace(/\\\]/g, "]");
};

const createOpenAITurndownService = () => {
  const turndownService = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
  });

  // button 태그 제거 규칙
  turndownService.addRule("button", {
    filter: "button",
    replacement: () => "",
  });

  // pre 태그 처리 규칙
  turndownService.addRule("pre", {
    filter: ["pre"],
    replacement: (content, node) => {
      const codeElement = node.querySelector("code");
      if (!codeElement) return "";

      const language = codeElement.className?.match(/language-(\w+)/)?.[1] || "";
      const code = codeElement.textContent.trim();
      return `\n\`\`\`${language}\n${code}\n\`\`\`\n\n`;
    },
  });

  // inline code 처리
  turndownService.addRule("code", {
    filter: (node) => node.nodeName === "CODE" && !node.parentNode.matches("pre"),
    replacement: (content) => `\`${content}\``,
  });

  return turndownService;
};

const convertOpenAIHtmlToMarkdown = (html) => {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const turndownService = createOpenAITurndownService();

  let markdownContent = "";

  // 메시지 쌍을 찾습니다
  const messages = doc.querySelectorAll("div[data-message-author-role]");

  let currentUserMessage = null;
  let currentAssistantMessage = null;

  messages.forEach((message) => {
    const role = message.getAttribute("data-message-author-role");
    const content = message.querySelector(".markdown, .whitespace-pre-wrap")?.innerHTML || "";

    if (role === "user") {
      // 이전 메시지 쌍이 있으면 먼저 처리
      if (currentUserMessage && currentAssistantMessage) {
        markdownContent += processMessagePair(currentUserMessage, currentAssistantMessage, turndownService);
      }
      currentUserMessage = content;
      currentAssistantMessage = null;
    } else if (role === "assistant") {
      currentAssistantMessage = content;
    }
  });

  // 마지막 메시지 쌍 처리
  if (currentUserMessage && currentAssistantMessage) {
    markdownContent += processMessagePair(currentUserMessage, currentAssistantMessage, turndownService);
  }

  // 대괄호 이스케이프 제거 후 반환
  return unescapeBrackets(markdownContent);
};

const processMessagePair = (userContent, assistantContent, turndownService) => {
  let markdown = "";

  // 사용자 메시지 처리
  markdown += "## user prompt\n\n";
  // 줄바꿈을 보존하고 ~~~ 로 감싸기
  const userMarkdown = turndownService
    .turndown(userContent)
    .replace(/<br\s*\/?>/gi, "\n") // <br> 태그를 줄바꿈으로 변환
    .replace(/```/g, "~~~") // 코드 블록 마커를 ~~~ 로 변경
    .split("\n") // 줄별로 분리
    .map((line) => line.trim()) // 각 줄의 앞뒤 공백 제거
    .join("\n"); // 다시 합치기

  // 코드 블록이 아닌 경우에만 ~~~로 감싸기
  if (!userMarkdown.includes("~~~")) {
    markdown += "~~~\n" + userMarkdown + "\n~~~\n\n";
  } else {
    markdown += userMarkdown + "\n\n";
  }

  // 어시스턴트 메시지 처리
  markdown += "## assistant says\n\n";
  markdown += turndownService.turndown(assistantContent) + "\n\n";

  markdown += "---\n\n";

  return markdown;
};

// * fetch
const fetchFromOpenai = async (source, email = defaultEmail) => {
  chromeOptions.default.email = email;
  const chrome = new Chrome(chromeOptions.default);

  // 목표 URL로 이동
  await chrome.goto(source);
  await chrome.getFullSize();
  await sleepAsync(5000);
  // await chrome.driver.wait(until.elementLocated(By.id("user_contents")));
  // 페이지 소스 가져오기
  const html = await chrome.driver.getPageSource();

  const cheerio = new Cheerio(html);
  const title = cheerio.value("head title");
  const content = cheerio.outerHtml('div[role="presentation"]');
  let markdown = `---\ntitle: ${title}\nemail: ${email}\nsource: ${source}\n---\n\n`;
  markdown += convertOpenAIHtmlToMarkdown(content);

  await chrome.close();
  return { title, content, markdown };
};

export { fetchFromOpenai };
