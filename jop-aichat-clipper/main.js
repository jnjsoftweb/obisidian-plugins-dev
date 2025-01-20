const { Plugin, Notice, PluginSettingTab, Setting } = require("obsidian");

const DEFAULT_SETTINGS = {
  saveFolder: "99. AI/chats",
  overwrite: false,
  proxyUrl: "http://localhost:3000/proxy",  // 프록시 서버 URL
  turndownOptions: {
    headingStyle: "atx",
    codeBlockStyle: "fenced"
  }
};

class AIChatClipperPlugin extends Plugin {
  async onload() {
    await this.loadSettings();
    
    console.log("AI Chat Clipper 플러그인이 로드되었습니다.");
    
    // turndown 스크립트 로드
    await this.loadTurndown();
    
    // 설정 탭 추가
    this.addSettingTab(new AIChatClipperSettingTab(this.app, this));
    
    // 명령어 추가
    this.addCommand({
      id: "clip-claude-chat",
      name: "Clip Claude Chat",
      callback: () => this.clipClaudeChat(),
    });
  }

  onunload() {
    console.log("AI Chat Clipper 플러그인이 언로드되었습니다.");
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async clipClaudeChat() {
    try {
      // 클립보드에서 내용 가져오기
      const clipText = await navigator.clipboard.readText();
      
      if (!clipText) {
        new Notice("클립보드가 비어있습니다.");
        return;
      }

      let content = clipText;
      
      // URL인 경우 프록시 서버를 통해 내용 가져오기
      if (clipText.startsWith('http')) {
        console.log('URL이 감지되어 프록시 서버를 통해 내용을 가져옵니다:', clipText);
        try {
          const proxyUrl = `${this.settings.proxyUrl}?url=${encodeURIComponent(clipText)}`;
          console.log('프록시 URL:', proxyUrl);
          
          const response = await fetch(proxyUrl);
          if (!response.ok) {
            throw new Error(`프록시 서버 에러: ${response.status}`);
          }
          content = await response.text();
          console.log('프록시 서버에서 받은 내용 길이:', content.length);
        } catch (proxyError) {
          console.error('프록시 서버 요청 실패:', proxyError);
          new Notice("프록시 서버에서 내용을 가져오는데 실패했습니다: " + proxyError.message);
          return;
        }
      }

      // HTML을 마크다운으로 변환
      const markdown = this.convertHtmlToMarkdown(content);

      if (!markdown) {
        new Notice("변환할 내용이 없습니다. 클로드 채팅 페이지의 내용을 직접 복사해주세요.");
        return;
      }

      // 파일 저장
      const fileName = `claude_chat_${this.getTimestamp()}.md`;
      const filePath = `${this.settings.saveFolder}/${fileName}`;
      
      await this.saveMarkdownFile(filePath, markdown);
      
      new Notice("Claude 채팅이 성공적으로 저장되었습니다.");
    } catch (error) {
      console.error("Error in clipClaudeChat:", error);
      new Notice("채팅 저장 중 오류가 발생했습니다: " + error.message);
    }
  }

  async fetchPageContent(url) {
    try {
      console.log("페이지 내용 가져오기:", url);
      
      // 프록시 서버를 통해 페이지 내용 가져오기
      const proxyUrl = `${this.settings.proxyUrl}?url=${encodeURIComponent(url)}`;
      console.log("프록시 URL:", proxyUrl);

      const response = await fetch(proxyUrl, {
        method: 'GET',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ko-KR,ko;q=0.9',
        }
      });
      
      console.log("프록시 응답 상태:", response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const html = await response.text();
      console.log("받은 HTML 길이:", html.length);
      console.log("HTML 내용 일부:", html.substring(0, 200));

      // HTML 내용을 파일로 저장
      const debugFolder = `${this.settings.saveFolder}/debug`;
      await this.ensureFolder(debugFolder);
      
      const urlObj = new URL(url);
      const chatId = urlObj.pathname.split('/').pop();
      const debugFileName = `claude_chat_${chatId}_${this.getTimestamp()}.html`;
      const debugFilePath = `${debugFolder}/${debugFileName}`;
      
      await this.app.vault.create(debugFilePath, html);
      console.log("HTML 내용이 저장됨:", debugFilePath);

      return html;
    } catch (error) {
      console.error("Error fetching page content:", error);
      throw error;
    }
  }

  async loadTurndown() {
    // turndown 스크립트가 이미 로드되어 있는지 확인
    if (window.TurndownService) {
      return;
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/turndown/7.1.2/turndown.min.js";
      script.onload = () => {
        console.log("Turndown 라이브러리가 로드되었습니다.");
        resolve();
      };
      script.onerror = (error) => {
        console.error("Turndown 라이브러리 로드 실패:", error);
        reject(error);
      };
      document.head.appendChild(script);
    });
  }

  convertHtmlToMarkdown(html) {
    try {
      if (!window.TurndownService) {
        throw new Error("Turndown 라이브러리가 로드되지 않았습니다.");
      }

      console.log("HTML to Markdown 변환 시작");
      console.log("HTML 길이:", html.length);

      const turndownService = new window.TurndownService(this.settings.turndownOptions);
      console.log("Turndown 서비스 생성됨");

      // HTML을 마크다운으로 변환
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      console.log("HTML 파싱 완료");

      let markdownContent = "";
      const userMessages = doc.querySelectorAll('[data-testid="user-message"]');
      const claudeResponses = doc.querySelectorAll("[data-test-render-count]:nth-child(even)");

      console.log("찾은 메시지 수:", {
        userMessages: userMessages.length,
        claudeResponses: claudeResponses.length
      });

      for (let i = 0; i < userMessages.length; i++) {
        console.log(`메시지 ${i + 1} 처리 중`);
        markdownContent += "## user prompt\n\n";
        const userMarkdown = this.convertUserMessageToMarkdown(userMessages[i]);
        console.log(`사용자 메시지 ${i + 1} 변환됨:`, userMarkdown.substring(0, 100));
        markdownContent += userMarkdown;
        
        markdownContent += "## claude says\n\n";
        if (claudeResponses[i]) {
          const claudeMarkdown = turndownService.turndown(claudeResponses[i].innerHTML);
          console.log(`Claude 응답 ${i + 1} 변환됨:`, claudeMarkdown.substring(0, 100));
          markdownContent += `${claudeMarkdown}\n\n`;
        } else {
          console.log(`Claude 응답 ${i + 1} 없음`);
          markdownContent += "답변 없음\n\n";
        }
        markdownContent += "---\n\n";
      }

      console.log("최종 마크다운 길이:", markdownContent.length);
      return markdownContent;
    } catch (error) {
      console.error("Error converting HTML to Markdown:", error);
      throw error;
    }
  }

  convertUserMessageToMarkdown(userMessageNode) {
    let markdown = "";
    const children = userMessageNode.children;

    for (let j = 0; j < children.length; j++) {
      const child = children[j];

      if (child.nodeName === "P") {
        let pContent = child.textContent.replace(/<a[^>]*>|<\/a>/g, "");
        markdown += pContent + "\n\n";
      } else if (child.nodeName === "CODE") {
        let codeContent = "";
        child.childNodes.forEach((codeChild) => {
          if (codeChild.nodeType === Node.TEXT_NODE) {
            codeContent += codeChild.textContent;
          } else if (codeChild.nodeName === "SPAN") {
            codeContent += codeChild.textContent + "\n";
          }
        });

        markdown += `\n\`\`\`\n${codeContent.trim()}\n\`\`\`\n\n`;
      }
    }
    return markdown;
  }

  getTimestamp() {
    const now = new Date();
    return now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  }

  async ensureFolder(folderPath) {
    try {
      const normalizedPath = this.app.vault.adapter.getFullPath(folderPath);
      const exists = await this.app.vault.adapter.exists(normalizedPath);
      
      if (!exists) {
        await this.app.vault.createFolder(folderPath);
      }
      // 폴더가 이미 존재하는 경우는 정상적인 상황으로 처리
      return true;
    } catch (error) {
      // 폴더 생성 실패 시에만 에러 처리
      if (!error.message.includes('already exists')) {
        console.error("Error creating folder:", error);
        throw error;
      }
      return true;
    }
  }

  async saveMarkdownFile(filePath, content) {
    try {
      // 파일 저장 전에 폴더 생성
      const folderCreated = await this.ensureFolder(this.settings.saveFolder);
      if (!folderCreated) {
        throw new Error("폴더를 생성할 수 없습니다.");
      }
      
      // 파일 존재 여부 확인
      const exists = await this.app.vault.adapter.exists(filePath);
      if (exists && !this.settings.overwrite) {
        throw new Error("파일이 이미 존재합니다.");
      }
      
      // 파일 저장
      if (exists) {
        // 파일이 존재하고 덮어쓰기가 허용된 경우
        const file = this.app.vault.getAbstractFileByPath(filePath);
        await this.app.vault.modify(file, content);
      } else {
        // 새 파일 생성
        await this.app.vault.create(filePath, content);
      }
    } catch (error) {
      console.error("Error saving file:", error);
      throw error;
    }
  }
}

class AIChatClipperSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    
    containerEl.createEl("h2", { text: "AI Chat Clipper 설정" });

    new Setting(containerEl)
      .setName("저장 폴더")
      .setDesc("채팅 내용이 저장될 폴더 경로입니다.")
      .addText((text) =>
        text
          .setPlaceholder("예: 99. AI/chats")
          .setValue(this.plugin.settings.saveFolder)
          .onChange(async (value) => {
            this.plugin.settings.saveFolder = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("프록시 서버 URL")
      .setDesc("CORS 우회를 위한 프록시 서버의 URL입니다.")
      .addText((text) =>
        text
          .setPlaceholder("예: http://localhost:3000/proxy")
          .setValue(this.plugin.settings.proxyUrl)
          .onChange(async (value) => {
            this.plugin.settings.proxyUrl = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("파일 덮어쓰기")
      .setDesc("파일이 이미 존재할 경우 덮어쓸지 여부를 설정합니다.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.overwrite)
          .onChange(async (value) => {
            this.plugin.settings.overwrite = value;
            await this.plugin.saveSettings();
          })
      );
  }
}

module.exports = AIChatClipperPlugin; 