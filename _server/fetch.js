// npm i dotenv jnj-utils

// import { loadJson, Chrome, sleepAsync, saveFile, saveJson, Cheerio } from "jnj-utils";
import { Chrome, sleepAsync, saveJson, Cheerio } from "jnj-utils";
import { chromeOptions, selectors, email } from "./settings.js";
// console.log(YOUTUBE_API_URL, YOUTUBE_API_KEY);

// * Daum Poordoctor
const fetchFromDaumPoordoctor = async (targetUrl) => {
  const chrome = new Chrome(chromeOptions.daum);

  // 목표 URL로 이동
  await chrome.goto(targetUrl);
  await chrome.getFullSize();
  await sleepAsync(2000);

  // iframe 전환
  await chrome.driver.switchTo().frame("down");

  // 페이지 소스 가져오기
  const source = await chrome.driver.getPageSource();

  const cheerio = new Cheerio(source);
  const title = cheerio.value(selectors.poordoctor.title);
  const author = cheerio.value(selectors.poordoctor.author);
  const views = cheerio.value(selectors.poordoctor.views);
  const content = cheerio.outerHtml(selectors.poordoctor.content);

  await chrome.close();
  return { title, author, views, content };
};

export { fetchFromDaumPoordoctor };

// * TEST
// * Daum Poordoctor
// const targetUrl = "https://cafe.daum.net/poordoctor/OHl4/260636";
// const result = await fetchFromDaumPoordoctor(targetUrl);
// saveJson("./downloads/poordoctor.json", result);

// * Claude
// const targetUrl = "https://claude.ai/chat/a9d32c70-f740-4a54-ae5d-49ee72423018";
// const result = await fetchFromClaude(targetUrl);
// saveJson("./downloads/claude.json", result);

// // * Openai
// const targetUrl = "https://chatgpt.com/c/67821379-a400-8012-899f-2f2b05178b1f";
// const result = await fetchFromOpenai(targetUrl);
// saveJson("./downloads/openai.json", result);
