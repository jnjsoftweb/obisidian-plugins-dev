const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const app = express();

// 로깅 미들웨어 추가
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// CORS 설정
app.use(cors());

// HTML 저장 폴더 생성
const htmlDir = path.join(__dirname, 'html');
console.log('HTML 저장 경로:', htmlDir);

try {
  if (!fs.existsSync(htmlDir)) {
    fs.mkdirSync(htmlDir);
    console.log('HTML 폴더 생성됨:', htmlDir);
  } else {
    console.log('HTML 폴더가 이미 존재함:', htmlDir);
  }
} catch (error) {
  console.error('HTML 폴더 생성 중 에러:', error);
}

// 프록시 엔드포인트
app.get('/proxy', async (req, res) => {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[${requestId}] 새로운 프록시 요청 시작`);
  
  try {
    const url = req.query.url;
    if (!url) {
      console.log(`[${requestId}] URL 파라미터가 없습니다.`);
      return res.status(400).send('URL parameter is required');
    }

    console.log(`[${requestId}] 요청된 URL:`, url);

    console.log(`[${requestId}] fetch 요청 시작...`);
    const response = await fetch(url, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      }
    });

    console.log(`[${requestId}] 응답 상태:`, response.status);
    console.log(`[${requestId}] 응답 헤더:`, Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log(`[${requestId}] 응답 내용 읽기 시작...`);
    const content = await response.text();
    console.log(`[${requestId}] 응답 내용 길이:`, content.length);
    console.log(`[${requestId}] 응답 내용 일부:`, content.substring(0, 200));

    // HTML 파일 저장
    const urlObj = new URL(url);
    const chatId = urlObj.pathname.split('/').pop();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `claude_chat_${chatId}_${timestamp}.html`;
    const filePath = path.join(htmlDir, fileName);

    console.log(`[${requestId}] HTML 파일 저장 시작:`, filePath);
    try {
      fs.writeFileSync(filePath, content);
      console.log(`[${requestId}] HTML 파일 저장 완료:`, filePath);
    } catch (fileError) {
      console.error(`[${requestId}] HTML 파일 저장 실패:`, fileError);
    }

    console.log(`[${requestId}] 클라이언트에 응답 전송`);
    res.send(content);
    console.log(`[${requestId}] 요청 처리 완료`);
  } catch (error) {
    console.error(`[${requestId}] 프록시 처리 중 에러:`, error);
    res.status(500).send(error.message);
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log('='.repeat(50));
  console.log(`프록시 서버가 포트 ${port}에서 실행 중입니다.`);
  console.log('서버 시작 시간:', new Date().toISOString());
  console.log('='.repeat(50));
}); 