
```prompt
@jnj-class101 폴더에 있는 코드를 숙지해주세요.

위의 코드를 참고하여,

@op-class101 폴더에 옵시디언 플러그인을 만들려고 해요.

@.env 의 내용들은 @op-class101 의 플러그인에서는 설정에서 조정할 수 있는 변수로 만들어주세요.
```


먼저 플러그인의 설정을 위한 코드를 작성하겠습니다:

````javascript:op-class101/main.js
const { Plugin, Notice, PluginSettingTab, Setting } = require("obsidian");

const DEFAULT_SETTINGS = {
  markdownRootDir: "33. RESOURCES/Lectures/class101",  // MARKDOWN_ROOT_DIR
  baseUrl: "http://localhost:4000",                    // BASE_URL
  reviewTemplate: "templates/review.md",               // REVIEW_TEMPLATE
  lecturesDir: "lectures",
  reviewsDir: "reviews",
  notesDir: "notes",
  scriptsDir: "scripts",
  classesDir: "classes"
};

class Class101Plugin extends Plugin {
  async onload() {
    await this.loadSettings();
    
    console.log("Class101 플러그인이 로드되었습니다.");
    
    // 설정 탭 추가
    this.addSettingTab(new Class101SettingTab(this.app, this));
    
    // 명령어 추가
    this.addCommand({
      id: "process-single-class",
      name: "Process Single Class",
      callback: () => this.processSingleClass(),
    });

    this.addCommand({
      id: "process-all-classes",
      name: "Process All Classes",
      callback: () => this.processAllClasses(),
    });
  }

  onunload() {
    console.log("Class101 플러그인이 언로드되었습니다.");
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

class Class101SettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    
    containerEl.createEl("h2", { text: "Class101 설정" });

    new Setting(containerEl)
      .setName("마크다운 루트 디렉토리")
      .setDesc("Class101 강의 노트가 저장될 기본 경로입니다.")
      .addText((text) =>
        text
          .setPlaceholder("예: 33. RESOURCES/Lectures/class101")
          .setValue(this.plugin.settings.markdownRootDir)
          .onChange(async (value) => {
            this.plugin.settings.markdownRootDir = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("기본 URL")
      .setDesc("Class101 API 서버의 기본 URL입니다.")
      .addText((text) =>
        text
          .setPlaceholder("예: http://localhost:4000")
          .setValue(this.plugin.settings.baseUrl)
          .onChange(async (value) => {
            this.plugin.settings.baseUrl = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("리뷰 템플릿 경로")
      .setDesc("리뷰 노트에 사용될 템플릿 파일의 경로입니다.")
      .addText((text) =>
        text
          .setPlaceholder("예: templates/review.md")
          .setValue(this.plugin.settings.reviewTemplate)
          .onChange(async (value) => {
            this.plugin.settings.reviewTemplate = value;
            await this.plugin.saveSettings();
          })
      );

    // 하위 디렉토리 설정
    const subDirs = ["lectures", "reviews", "notes", "scripts", "classes"];
    subDirs.forEach(dir => {
      const settingKey = `${dir}Dir`;
      new Setting(containerEl)
        .setName(`${dir} 디렉토리`)
        .setDesc(`${dir} 파일이 저장될 하위 경로입니다.`)
        .addText((text) =>
          text
            .setPlaceholder(`예: ${dir}`)
            .setValue(this.plugin.settings[settingKey])
            .onChange(async (value) => {
              this.plugin.settings[settingKey] = value;
              await this.plugin.saveSettings();
            })
        );
    });
  }
}

module.exports = Class101Plugin;
````

그리고 플러그인의 manifest.json도 작성하겠습니다:

````json:op-class101/manifest.json
{
  "id": "op-class101",
  "name": "Class101 Plugin",
  "version": "1.0.0",
  "minAppVersion": "0.15.0",
  "description": "Class101 강의 노트를 Obsidian에서 관리하기 위한 플러그인입니다.",
  "author": "Your Name",
  "authorUrl": "https://github.com/yourusername",
  "isDesktopOnly": true
}
````

이 플러그인은:

1. .env 파일의 설정들을 Obsidian 플러그인 설정으로 옮겼습니다:
   - MARKDOWN_ROOT_DIR → markdownRootDir
   - BASE_URL → baseUrl
   - REVIEW_TEMPLATE → reviewTemplate

2. 추가로 하위 디렉토리 구조도 설정에서 조정할 수 있게 했습니다:
   - lecturesDir
   - reviewsDir
   - notesDir
   - scriptsDir
   - classesDir

3. 두 가지 명령어를 제공합니다:
   - "Process Single Class": 단일 클래스 처리
   - "Process All Classes": 모든 클래스 처리

다음으로는 jnj-class101의 MarkdownGenerator 클래스의 기능들을 Obsidian 플러그인에 맞게 포팅하는 작업이 필요합니다. 계속 진행할까요?

---

```prompt
Process Single Class 처리에서 classId는 어떻게 설정하나요?
```


클립보드에서 Class101 URL을 읽어와서 classId를 추출하는 방식으로 구현하는 것이 좋을 것 같습니다. YouTube Clipper 플러그인과 비슷한 방식으로 구현해보겠습니다:

````javascript:op-class101/main.js
class Class101Plugin extends Plugin {
  async onload() {
    // ... existing code ...

    this.addCommand({
      id: "process-single-class",
      name: "Process Single Class from Clipboard",
      callback: () => this.processSingleClass(),
    });
  }

  // Class101 URL에서 classId를 추출하는 메서드
  extractClassId(url) {
    try {
      // class101.net/ko/classes/{classId} 형식의 URL 처리
      if (url.includes("class101.net/ko/classes/")) {
        const classId = url.split("classes/")[1].split("/")[0];
        return classId;
      }
      return null;
    } catch (error) {
      console.error("URL 변환 오류:", error);
      return null;
    }
  }

  async processSingleClass() {
    try {
      const clipText = await navigator.clipboard.readText();
      const classId = this.extractClassId(clipText);

      if (!classId) {
        new Notice("유효한 Class101 URL이 클립보드에 없습니다.");
        return;
      }

      new Notice("강의 정보를 가져오고 있습니다...");
      
      // 여기서 실제 처리 로직 구현
      await this.generateMarkdown(classId);
      
    } catch (error) {
      console.error("Error:", error);
      new Notice(`강의 처리 중 오류가 발생했습니다: ${error.message}`);
    }
  }
}
````

이렇게 구현하면:

1. 사용자가 Class101 강의 페이지를 열고 URL을 복사합니다 (예: https://class101.net/ko/classes/5c6f91d274eabcfdafa1e5ff)
2. Obsidian에서 "Process Single Class from Clipboard" 명령을 실행합니다
3. 플러그인이 클립보드에서 URL을 읽어와 classId를 추출합니다
4. 추출된 classId로 강의 처리를 시작합니다

이 방식의 장점:
- 사용자가 직접 classId를 입력할 필요가 없습니다
- URL만 복사하면 되므로 사용이 간편합니다
- YouTube Clipper와 비슷한 사용자 경험을 제공합니다

추가로 모달 대화상자를 통해 직접 classId를 입력하는 방식도 구현할 수 있습니다. 이 방식도 추가할까요?


```
https://class101.net/ko/classes/5c9bb8739eff0eeadb23aec1
```