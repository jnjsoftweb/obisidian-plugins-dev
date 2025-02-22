/*
THIS IS A GENERATED/BUNDLED FILE BY ESBUILD
*/

"use strict";

// main.js
var { Plugin, Notice, PluginSettingTab, Setting } = require("obsidian");
var DEFAULT_SETTINGS = {
  saveFolder: "10. Clippings",
  apiSummaryUrl: "https://n8n.bigwhiteweb.com/webhook/youtube-summary",
  apiInfoUrl: "https://n8n.bigwhiteweb.com/webhook/youtube-info"
};
var YouTubeTranscriptPlugin = class extends Plugin {
  async onload() {
    await this.loadSettings();
    console.log("YouTube Clipper 플러그인이 로드되었습니다.");
    this.addSettingTab(new YouTubeTranscriptSettingTab(this.app, this));
    this.addCommand({
      id: "save-youtube-clipper",
      name: "Save YouTube Clipper",
      callback: () => this.saveTranscript(),
    });
    this.addCommand({
      id: "save-all-youtube-clipper",
      name: "Save All YouTube Clipper from Current Note",
      editorCallback: async (editor) => {
        const content = editor.getValue();
        await this.saveAllTranscripts(content);
      },
    });
  }
  onunload() {
    console.log("YouTube Clipper 플러그인이 언로드되었습니다.");
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  normalizeYouTubeUrl(url) {
    try {
      // youtu.be 형식의 URL 처리
      if (url.includes("youtu.be/")) {
        const videoId = url.split("youtu.be/")[1].split("?")[0];
        return `https://www.youtube.com/watch?v=${videoId}`;
      }

      // 이미 표준 형식인 경우
      if (url.includes("youtube.com/watch?v=")) {
        return url;
      }

      return null;
    } catch (error) {
      console.error("URL 변환 오류:", error);
      return null;
    }
  }
  async saveTranscript() {
    try {
      const clipText = await navigator.clipboard.readText();
      const normalizedUrl = this.normalizeYouTubeUrl(clipText);

      if (!normalizedUrl) {
        new Notice("유효한 YouTube URL이 클립보드에 없습니다.");
        return;
      }

      const videoId = new URLSearchParams(new URL(normalizedUrl).search).get("v");
      if (!videoId) {
        new Notice("동영상 ID를 찾을 수 없습니다.");
        return;
      }

      new Notice("자막을 분석하고 있습니다...");
      
      // API 응답 확인을 위한 로깅 추가
      try {
        const [transcriptResponse, infoResponse] = await Promise.all([
          this.fetchWithTimeout(`${this.settings.apiSummaryUrl}?videoId=${videoId}`),
          this.fetchWithTimeout(`${this.settings.apiInfoUrl}?videoId=${videoId}`),
        ]);

        // 응답 상태 확인 및 자세한 에러 메시지
        if (!transcriptResponse.ok) {
          const errorText = await transcriptResponse.text();
          console.error("Transcript API 오류:", errorText);
          throw new Error(`자막 데이터를 가져올 수 없습니다. (상태 코드: ${transcriptResponse.status})`);
        }

        if (!infoResponse.ok) {
          const errorText = await infoResponse.text();
          console.error("Info API 오류:", errorText);
          throw new Error(`동영상 정보를 가져올 수 없습니다. (상태 코드: ${infoResponse.status})`);
        }

        const [transcriptData, infoData] = await Promise.all([
          transcriptResponse.json(),
          infoResponse.json()
        ]);

        // 응답 데이터 유효성 검사
        if (!transcriptData || !transcriptData.content) {
          console.error("잘못된 자막 데이터:", transcriptData);
          throw new Error("자막 데이터가 올바르지 않습니다.");
        }

        if (!infoData || !infoData.info) {
          console.error("잘못된 동영상 정보:", infoData);
          throw new Error("동영상 정보가 올바르지 않습니다.");
        }

        // 태그 추출 및 처리
        const tagMatch = transcriptData.content.match(/## tags:\n(.*?)\n\n/s);
        const additionalTags = tagMatch
          ? tagMatch[1].split(", ").map(
              (tag) => tag.replace(/\s+/g, "").replace("[", "").replace("]", "") // 공백 제거, '[]' 제거
            )
          : [];

        const content =
          this.formatVideoMetadata(infoData.info, videoId, additionalTags) +
          "\n## description\n\n" +
          infoData.info.description +
          "\n\n\n## summary\n" +
          transcriptData.content.match(/## summary:\n(.*?)\n\n\n## content:/s)[1].replace(/\n{3,}/g, "\n\n") +
          "\n\n\n## content\n" +
          transcriptData.content.match(/## content:\n(.*?)$/s)[1].replace(/\n{3,}/g, "\n\n");

        const safeTitle = this.sanitizeName(infoData.info.title);
        const fileName = `${safeTitle}.md`;
        const filePath = this.settings.saveFolder ? `${this.settings.saveFolder}/${fileName}` : fileName;

        if (this.settings.saveFolder) {
          try {
            if (!(await this.app.vault.adapter.exists(this.settings.saveFolder))) {
              await this.app.vault.createFolder(this.settings.saveFolder);
            }
          } catch (err) {
            console.error("폴더 생성 오류:", err);
          }
        }

        await this.app.vault.create(filePath, content);
        new Notice(`자막이 저장되었습니다: ${fileName}`);
      } catch (apiError) {
        console.error("API 요청 오류:", apiError);
        throw new Error(`API 요청 실패: ${apiError.message}`);
      }

    } catch (error) {
      console.error("Error:", error);
      new Notice(`자막 저장 중 오류가 발생했습니다: ${error.message}`);
    }
  }
  async fetchWithTimeout(url, timeout = 180000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === "AbortError") {
        throw new Error("요청 시간이 초과되었습니다. 다시 시도해주세요.");
      }
      throw error;
    }
  }
  formatVideoMetadata(info, videoId, additionalTags = []) {
    const today = new Date().toISOString().split("T")[0];
    const published = new Date(info.published).toISOString().split("T")[0];
    const duration = info.duration.replace("PT", "").replace("H", ":").replace("M", ":").replace("S", "");
    const durationParts = duration.split(":");
    let formattedDuration = "";
    if (durationParts.length === 3) {
      formattedDuration = durationParts.map((part) => part.padStart(2, "0")).join(":");
    } else if (durationParts.length === 2) {
      formattedDuration = durationParts.map((part) => part.padStart(2, "0")).join(":");
    } else {
      formattedDuration = `00:${durationParts[0].padStart(2, "0")}`;
    }

    // 기본 태그와 추가 태그 결합
    const allTags = ["clippings/youtube", ...additionalTags];
    const formattedTags = allTags.map((tag) => `  - ${tag}`).join("\n");

    const safeTitle = this.sanitizeName(info.title);
    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
    // 리뷰 파일 생성
    this.createReviewFile(safeTitle, youtubeUrl);

    return `---
title: ${info.title}
author: [[${info.channelTitle}]]
source: ${youtubeUrl}
created: ${today}
published: ${published}
thumbnail: ${info.thumbnail}
duration: ${formattedDuration}
channelId: ${info.channelId}
viewCount: ${info.viewCount}
likeCount: ${info.likeCount}
categoryId: ${info.categoryId}
tags:
${formattedTags}
---

![${info.title}](${youtubeUrl})

## review

[[${safeTitle}_review|📝 리뷰 작성]]

`;
  }
  sanitizeName(name) {
    return name
      .replace(/\[/g, "(")
      .replace(/\]/g, ")")
      .replace(/[^\uAC00-\uD7A3a-zA-Z0-9_\(\)\<\>\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }
  async saveAllTranscripts(content) {
    try {
      // YouTube URL 패턴 (youtu.be 형식과 @ 기호로 시작하는 URL 포함)
      const urlPattern = /@?https?:\/\/((?:www\.)?youtube\.com\/watch\?v=|youtu\.be\/)[a-zA-Z0-9_-]+(?:[?&][^\\s]*)?/g;
      const urls = content.match(urlPattern);

      if (!urls || urls.length === 0) {
        new Notice("현재 노트에서 YouTube URL을 찾을 수 없습니다.");
        return;
      }

      // URL 정규화 (@ 기호 제거 및 표준 형식으로 변환)
      const normalizedUrls = urls
        .map((url) => url.replace(/^@/, "")) // @ 기호 제거
        .map((url) => this.normalizeYouTubeUrl(url))
        .filter((url) => url !== null);

      if (normalizedUrls.length === 0) {
        new Notice("처리 가능한 YouTube URL이 없습니다.");
        return;
      }

      new Notice(`${normalizedUrls.length}개의 YouTube URL을 찾았습니다. 처리를 시작합니다...`);

      for (let i = 0; i < normalizedUrls.length; i++) {
        const url = normalizedUrls[i];
        const videoId = new URLSearchParams(new URL(url).search).get("v");

        if (!videoId) continue;

        try {
          new Notice(`(${i + 1}/${normalizedUrls.length}) 자막을 분석하고 있습니다...`);

          const [transcriptResponse, infoResponse] = await Promise.all([
            this.fetchWithTimeout(`${this.settings.apiSummaryUrl}?videoId=${videoId}`),
            this.fetchWithTimeout(`${this.settings.apiInfoUrl}?videoId=${videoId}`),
          ]);

          if (!transcriptResponse.ok || !infoResponse.ok) {
            console.error(`URL 처리 실패: ${url}`);
            continue;
          }

          const [transcriptData, infoData] = await Promise.all([transcriptResponse.json(), infoResponse.json()]);

          if (!transcriptData.content || !infoData.info) {
            console.error(`데이터 없음: ${url}`);
            continue;
          }

          const content = this.formatVideoMetadata(infoData.info, videoId) + transcriptData.content;
          // const content = this.formatVideoMetadata(infoData.info, videoId) + "\n## Content\n" + transcriptData.content;

          const safeTitle = this.sanitizeName(infoData.info.title);
          const fileName = `${safeTitle}.md`;
          const filePath = this.settings.saveFolder ? `${this.settings.saveFolder}/${fileName}` : fileName;

          if (this.settings.saveFolder) {
            try {
              if (!(await this.app.vault.adapter.exists(this.settings.saveFolder))) {
                await this.app.vault.createFolder(this.settings.saveFolder);
              }
            } catch (err) {
              console.error("폴더 생성 오류:", err);
            }
          }

          await this.app.vault.create(filePath, content);
          new Notice(`(${i + 1}/${normalizedUrls.length}) 저장 완료: ${fileName}`);

          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`URL 처리 중 오류 발생: ${url}`, error);
          new Notice(`URL 처리 실패: ${url}`);
        }
      }

      new Notice("모든 YouTube 자막 저장이 완료되었습니다.");
    } catch (error) {
      console.error("Error:", error);
      new Notice("자막 일괄 저장 중 오류가 발생했습니다: " + error.message);
    }
  }
  async createReviewFile(noteName, sourceUrl) {
    try {
        // Review 폴더 경로 생성
        const reviewFolderPath = this.settings.saveFolder 
            ? `${this.settings.saveFolder}/Reviews`
            : 'Reviews';
            
        // Review 폴더가 없으면 생성
        if (!(await this.app.vault.adapter.exists(reviewFolderPath))) {
            await this.app.vault.createFolder(reviewFolderPath);
        }

        const reviewFileName = `${noteName}_review.md`;
        const reviewFilePath = `${reviewFolderPath}/${reviewFileName}`;

        // 템플릿 파일 경로 수정
        const templatePath = `${this.app.vault.configDir}/templates/review.md`;
        console.log(templatePath);
        
        let templateContent;
        try {
            templateContent = await this.app.vault.adapter.read(templatePath);
        } catch (error) {
            // 템플릿 파일이 없는 경우 기본 템플릿 사용
            templateContent = `---
title: 
source: 
viewCount: 0
difficulty: 3
likeability: 3
tags:
  - review/youtube
---

### 원본

![youtube 동영상]()

[[Clipping 원본]]



### 정리/요약




### 3줄평



`;
        }
        
        // 템플릿 내용 치환
        const reviewContent = templateContent
            .replace('title: ', `title: ${noteName}`)
            .replace('source: ', `source: ${sourceUrl}`)
            .replace('![youtube 동영상]()', `![youtube 동영상](${sourceUrl})`)
            .replace('[[Clipping 원본]]', `[[${noteName}|Clipping 원본]]`);

        // 리뷰 파일 생성
        if (!(await this.app.vault.adapter.exists(reviewFilePath))) {
            await this.app.vault.create(reviewFilePath, reviewContent);
        }
    } catch (error) {
        console.error('리뷰 파일 생성 중 오류:', error);
        new Notice('리뷰 파일 생성 중 오류가 발생했습니다.');
    }
  }
};
var YouTubeTranscriptSettingTab = class extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "YouTube Clipper 설정" });
    
    new Setting(containerEl)
      .setName("저장 폴더")
      .setDesc("자막 파일이 저장될 폴더 경로를 지정합니다.")
      .addText((text) =>
        text
          .setPlaceholder("예: YouTube Clipper")
          .setValue(this.plugin.settings.saveFolder)
          .onChange(async (value) => {
            this.plugin.settings.saveFolder = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("요약 API URL")
      .setDesc("YouTube 자막 요약 API의 URL을 지정합니다.")
      .addText((text) =>
        text
          .setPlaceholder("예: https://api.example.com/youtube-summary")
          .setValue(this.plugin.settings.apiSummaryUrl)
          .onChange(async (value) => {
            this.plugin.settings.apiSummaryUrl = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("정보 API URL")
      .setDesc("YouTube 동영상 정보 API의 URL을 지정합니다.")
      .addText((text) =>
        text
          .setPlaceholder("예: https://api.example.com/youtube-info")
          .setValue(this.plugin.settings.apiInfoUrl)
          .onChange(async (value) => {
            this.plugin.settings.apiInfoUrl = value;
            await this.plugin.saveSettings();
          })
      );
  }
};
module.exports = YouTubeTranscriptPlugin;
