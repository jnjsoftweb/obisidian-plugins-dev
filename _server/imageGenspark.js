import { Chrome, sleepAsync, saveJson, saveFile, sanitizeName, loadFile, Cheerio } from 'jnj-utils';
import { chromeOptions, selectors, defaultEmail } from './settings.js';
import { Key } from 'selenium-webdriver';
import { writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import fetch from 'node-fetch';

// defaultEmail = 'jnjsoft.web@gmail.com';

// 이미지 다운로드 함수
const downloadImage = async (url, filename) => {
  try {
    const response = await fetch(url);
    const buffer = await response.buffer();
    await writeFile(filename, buffer);
    console.log(`이미지 다운로드 완료: ${filename}`);
  } catch (error) {
    console.error(`이미지 다운로드 실패: ${filename}`, error);
  }
};

// HTML에서 이미지 추출 및 저장
const saveImages = async (html, title) => {
  if (!html) {
    console.error('HTML 내용이 없습니다.');
    return;
  }

  const cheerio = new Cheerio(html);
  const imageUrls = cheerio.values('.image-generated img', 'data-preview-src');

  console.log(`찾은 이미지 수: ${imageUrls.length}`);

  // 이미지 다운로드
  const downloads = imageUrls.map(async (url, index) => {
    const filename = join(process.cwd(), 'downloads', `${title}_genspark_image_${index + 1}.png`);
    await downloadImage(url, filename);
  });

  await Promise.all(downloads);
  return imageUrls;
};

// * generate image
const generateImageByGenspark = async (prompt, autoPrompt = true, email = defaultEmail) => {
  const source = 'https://www.genspark.ai/agents?type=moa_generate_image';
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
    // * prompt 입력
    const promptInput = await chrome.findElement('textarea[name="query"]');
    await promptInput.sendKeys(prompt);
    await chrome.driver.sleep(1000);
    // * Enter 키
    await promptInput.sendKeys(Key.ENTER);
    // * 이미지 생성 기다림
    await chrome.driver.sleep(300000);

    // * 이미지 URL 추출 및 다운로드
    const html = await chrome.driver.getPageSource();
    const imageUrls = await saveImages(html, sanitizeName(prompt));
    // const cheerio = new Cheerio(html);
    // const imageUrls = [];

    // // 이미지 요소들 찾기
    // cheerio.find('.image-generated img').each((img) => {
    //   const previewSrc = img.attr('data-preview-src');
    //   if (previewSrc) {
    //     imageUrls.push(previewSrc);
    //   }
    // });

    // console.log(`찾은 이미지 수: ${imageUrls.length}`);

    // // 이미지 다운로드
    // const downloads = imageUrls.map(async (url, index) => {
    //   const filename = join(process.cwd(), 'downloads', `genspark_image_${index + 1}.png`);
    //   await downloadImage(url, filename);
    // });

    // await Promise.all(downloads);
    return imageUrls;
  } finally {
    await chrome.close();
  }
};

const prompt = '바다 위를 활공하는 갈매기떼를 갈매기를 근접한 앵글로 실사처럼 그려주세요.';
await generateImageByGenspark(prompt);

// // * 이미지 저장 테스트
// const testSaveImages = async () => {
//   const html = await loadFile(
//     'D:/Notes/Obsidian/liveSync/dev/.obsidian/plugins/_server/html/genspark_image_output_1.html'
//   );
//   await saveImages(html);
// };

// // 테스트 실행
// testSaveImages();
