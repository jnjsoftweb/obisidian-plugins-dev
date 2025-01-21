const { Plugin, Notice, PluginSettingTab, Setting, MarkdownRenderer } = require('obsidian');
const path = require('path');

const DEFAULT_SETTINGS = {
  rootDir: '33. RESOURCES/Lectures/class101',
  baseUrl: 'http://125.133.148.194:4000',
  templateDir: '93. templates/class101',
  lectureFolder: 'lectures',
  reviewFolder: 'reviews',
  noteFolder: 'notes',
  scriptFolder: 'scripts',
  classFolder: 'classes',
  overwrite: false,
};

class Class101Plugin extends Plugin {
  async onload() {
    await this.loadSettings();

    console.log('Class101 플러그인이 로드되었습니다.');

    // 설정 탭 추가
    this.addSettingTab(new Class101SettingTab(this.app, this));

    // 명령어 추가
    this.addCommand({
      id: 'process-single-class',
      name: 'Process Single Class from Clipboard',
      callback: () => this.processSingleClass(),
    });

    this.addCommand({
      id: 'process-all-classes',
      name: 'Process All Classes from Server',
      callback: () => this.processAllClasses(),
    });

    this.addCommand({
      id: 'process-in-file',
      name: 'Process Classes from Current File',
      callback: () => this.processInFile(),
    });

    // 클래스 목록 생성 명령어 추가
    this.addCommand({
      id: 'create-class-list',
      name: 'Create Class List',
      callback: () => this.createClassList(),
    });
  }

  onunload() {
    console.log('Class101 플러그인이 언로드되었습니다.');
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  // Class101 URL에서 classId를 추출하는 메서드
  extractClassId(url) {
    try {
      console.log('URL 분석:', url); // 디버깅을 위한 로그 추가

      // '/'가 없는 경우 입력된 문자열을 classId로 간주
      if (!url.includes('/')) {
        console.log('직접 입력된 classId:', url);
        return url;
      }

      // class101.net/ko/classes/{classId} 형식의 URL 처리
      if (url.includes('class101.net/ko/classes/')) {
        const classId = url.split('classes/')[1].split('/')[0];
        console.log('매칭된 classId:', classId); // 디버깅을 위한 로그 추가
        return classId;
      }

      // class101.net/classes/{classId} 형식의 URL도 처리
      if (url.includes('class101.net/classes/')) {
        const classId = url.split('classes/')[1].split('/')[0];
        console.log('매칭된 classId:', classId); // 디버깅을 위한 로그 추가
        return classId;
      }

      return null;
    } catch (error) {
      console.error('URL 변환 오류:', error);
      return null;
    }
  }

  async processSingleClass() {
    try {
      const clipText = await navigator.clipboard.readText();
      console.log('클립보드 내용:', clipText); // 디버깅을 위한 로그 추가

      const classId = this.extractClassId(clipText);
      console.log('추출된 classId:', classId); // 디버깅을 위한 로그 추가

      if (!classId) {
        new Notice('유효한 Class101 URL이 클립보드에 없습니다.');
        return;
      }

      new Notice('강의 정보를 가져오고 있습니다...');
      await this.generateMarkdown(classId);
    } catch (error) {
      console.error('Error:', error);
      new Notice(`강의 처리 중 오류가 발생했습니다: ${error.message}`);
    }
  }

  async generateMarkdown(classId) {
    try {
      const jsonBaseUrl = `${this.settings.baseUrl}/lecture/_repo/class101/json`;
      const htmlBaseUrl = `${this.settings.baseUrl}/lecture/_repo/class101/html`;

      // JSON 파일들 가져오기
      const [classesJson, categoriesJson, classInfo] = await Promise.all([
        this.fetchJson(`${jsonBaseUrl}/myclasses.json`),
        this.fetchJson(`${jsonBaseUrl}/categories.json`),
        this.fetchJson(`${jsonBaseUrl}/classes/${classId}.json`),
      ]);

      const lectures = Array.isArray(classInfo) ? classInfo : classInfo.lectures;
      // 테스트를 위해 lectures를 3개로 제한
      //   const limitedLectures = lectures.slice(0, 7);
      const limitedLectures = lectures;
      console.log(`테스트를 위해 ${limitedLectures.length}개의 강의만 처리합니다.`);

      const classData = classesJson.find((c) => c.classId === classId);

      if (!classData) {
        throw new Error(`Class ID ${classId} not found in myclasses.json`);
      }

      const classTitle = classData.title;
      const category = await this.getCategory(classId);
      const sanitizedClassTitle = this.sanitizeName(classTitle);
      const noteTitles = []; // 강의 노트 제목들을 저장할 배열

      // 각 카테고리별 클래스 폴더 경로 생성
      const basePath = this.settings.rootDir;
      const paths = {
        lectures: path.join(basePath, this.settings.lectureFolder, sanitizedClassTitle),
        reviews: path.join(basePath, this.settings.reviewFolder, sanitizedClassTitle),
        notes: path.join(basePath, this.settings.noteFolder, sanitizedClassTitle),
        scripts: path.join(basePath, this.settings.scriptFolder, sanitizedClassTitle),
        classes: path.join(basePath, this.settings.classFolder),
      };

      // 필요한 폴더들 생성
      for (const dir of Object.values(paths)) {
        await this.ensureFolder(dir);
      }

      // 각 강의별 처리 (limitedLectures 사용)
      for (let i = 0; i < limitedLectures.length; i++) {
        const lecture = limitedLectures[i];
        const lectureSlug = this.getLectureSlug(lecture);
        const noteTitle = `${lecture.sn.toString().padStart(3, '0')}_${this.sanitizeName(lecture.title)}`;
        noteTitles.push(noteTitle);

        new Notice(`강의 처리 중: ${noteTitle}`);

        await this.processLecture({
          lecture,
          classId,
          classTitle,
          category,
          sanitizedClassTitle,
          noteTitle,
          paths,
          htmlBaseUrl,
          prevNoteTitle: i > 0 ? noteTitles[i - 1] : null,
          nextNoteTitle:
            i < limitedLectures.length - 1
              ? `${limitedLectures[i + 1].sn.toString().padStart(3, '0')}_${this.sanitizeName(
                  limitedLectures[i + 1].title
                )}`
              : null,
        });
      }

      // 클래스 인덱스 파일 생성 (limitedLectures 사용)
      const classIndexContent = await this.createClassIndexContent({
        classTitle,
        noteTitles,
        category,
        sanitizedClassTitle,
      });

      const classIndexPath = path.join(paths.classes, `${sanitizedClassTitle}.md`);
      await this.app.vault.create(classIndexPath, classIndexContent);

      new Notice(`${classTitle} 강의 처리가 완료되었습니다.`);
    } catch (error) {
      console.error('Error in generateMarkdown:', error);
      throw error;
    }
  }

  async processLecture(data) {
    const {
      lecture,
      classId,
      classTitle,
      category,
      sanitizedClassTitle,
      noteTitle,
      paths,
      htmlBaseUrl,
      prevNoteTitle,
      nextNoteTitle,
    } = data;

    // currentClassId와 currentLectureSlug 설정
    this.currentClassId = classId;
    this.currentLectureSlug = this.getLectureSlug(lecture);

    const source = `https://class101.net/ko/classes/${classId}/lectures/${lecture.lectureId}`;
    const lectureSlug = this.getLectureSlug(lecture);

    // 노트 내용 가져오기
    let noteContent = '';
    try {
      const noteUrl = `${htmlBaseUrl}/classes/${classId}/${lectureSlug}/materials/index.html`;
      const noteHtml = await this.fetchHtml(noteUrl);

      // attachments 배열 생성
      const attachments = await this.fetchAttachments(classId, lectureSlug);
      const fileNames = attachments.map((url) => decodeURIComponent(url.split('/').pop()));

      noteContent = await this.convertHtmlToMarkdown(noteHtml, fileNames);

      if (noteContent) {
        const noteFilePath = path.join(paths.notes, `${noteTitle}_note.md`);
        await this.createFileWithOverwriteCheck(noteFilePath, noteContent);
      }
    } catch (error) {
      if (error.message.includes('파일이 이미 존재합니다')) {
        new Notice(error.message);
      } else {
        console.log(`No note content found for lecture ${lectureSlug}`);
      }
    }

    // 스크립트 내용 가져오기
    try {
      const scriptContent = await this.getScriptContent(lecture, sanitizedClassTitle, noteTitle);
      if (scriptContent) {
        const scriptPath = path.join(paths.scripts, `${noteTitle}_script.md`);
        await this.createFileWithOverwriteCheck(scriptPath, scriptContent);
      }
    } catch (error) {
      if (error.message.includes('파일이 이미 존재합니다')) {
        new Notice(error.message);
      } else {
        console.log(`No script content found for lecture ${lectureSlug}`);
      }
    }

    // 리뷰 파일 생성
    const reviewFilePath = path.join(paths.reviews, `${noteTitle}_review.md`);
    const reviewTemplate = await this.getReviewTemplate();
    const videoUrl = `${this.settings.baseUrl}/lecture/class101/${sanitizedClassTitle}/${noteTitle}.mkv`;
    const reviewContent = reviewTemplate
      .replace('{{lectureTitle}}', this.escapeYamlValue(lecture.title, true))
      .replace('{{source}}', source)
      .replace('{{videoUrl}}', videoUrl)
      .replace('{{noteTitle}}', noteTitle);
    await this.createFileWithOverwriteCheck(reviewFilePath, reviewContent);

    // 메인 강의 마크다운 생성
    const markdown = await this.createLectureMarkdown({
      lecture,
      classTitle,
      noteTitle,
      source,
      category,
      sanitizedClassTitle,
      hasNoteContent: !!noteContent,
      prevNoteTitle,
      nextNoteTitle,
      classId,
    });

    const markdownPath = path.join(paths.lectures, `${noteTitle}.md`);
    await this.createFileWithOverwriteCheck(markdownPath, markdown);
  }

  async fetchJson(url) {
    try {
      console.log('Fetching JSON from:', url);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`Error fetching JSON from ${url}:`, error);
      throw error;
    }
  }

  async fetchHtml(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.text();
    } catch (error) {
      console.error(`Error fetching HTML from ${url}:`, error);
      throw error;
    }
  }

  async getCategory(classId) {
    try {
      const jsonBaseUrl = `${this.settings.baseUrl}/lecture/_repo/class101/json`;

      // myclasses.json에서 classId에 해당하는 categoryId 찾기
      const myclasses = await this.fetchJson(`${jsonBaseUrl}/myclasses.json`);
      const classInfo = myclasses.find((c) => c.classId === classId);
      if (!classInfo) return '';

      // subCategories.json에서 categoryId와 일치하는 subCategory 찾기
      const subCategories = await this.fetchJson(`${jsonBaseUrl}/subCategories.json`);
      const subCategory = subCategories.find((sc) => sc.categoryId === classInfo.categoryId);
      if (!subCategory) return '';

      // categories.json에서 ancestorId와 categoryId가 일치하는 category 찾기
      const categoriesData = await this.fetchJson(`${jsonBaseUrl}/categories.json`);
      const category = categoriesData.find((c) => c.categoryId === subCategory.ancestorId);
      if (!category) return '';

      return `${category.title0}/${category.title}/${subCategory.title}`;
    } catch (error) {
      console.error('Error in getCategory:', error);
      return '';
    }
  }

  sanitizeName(name) {
    return name
      .replace(/\[/g, '(')
      .replace(/\]/g, ')')
      .replace(/[^\uAC00-\uD7A3a-zA-Z0-9_\(\)\<\>,\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  getLectureSlug(lecture) {
    return `${lecture.sn.toString().padStart(3, '0')}_${lecture.lectureId}`;
  }

  async ensureFolder(folderPath) {
    try {
      const normalizedPath = this.app.vault.adapter.getFullPath(folderPath);
      if (!(await this.app.vault.adapter.exists(normalizedPath))) {
        await this.app.vault.createFolder(folderPath);
      }
    } catch (error) {
      // overwrite가 true인 경우 폴더가 이미 존재하는 에러는 무시
      if (!this.settings.overwrite || !error.message.includes('Folder already exists')) {
        throw error;
      }
    }
  }

  async getReviewTemplate() {
    try {
      const templatePath = `${this.settings.templateDir}/review.md`;
      const templateContent = await this.app.vault.adapter.read(templatePath);
      return templateContent;
    } catch (error) {
      console.error('Error reading review template:', error);
      // 기본 템플릿 반환
      return `---
title: {{lectureTitle}}
viewCount: 0
difficulty: 3
likeability: 3
tags:
  - review/class101
---

### 정리/요약



### 3줄평


### 원본 노트

[[{{noteTitle}}|강의노트]]


`;
    }
  }

  async getLectureTemplate() {
    try {
      const templatePath = `${this.settings.templateDir}/lecture.md`;
      const templateContent = await this.app.vault.adapter.read(templatePath);
      return templateContent;
    } catch (error) {
      console.error('Error reading lecture template:', error);
      // 기본 템플릿 반환
      return `---
title: {{title}}
source: {{source}}
duration: {{duration}}
category: {{category}}
tags: {{tags}}
---

<video controls>
  <source src="{{videoUrl}}">
</video>

{{navigationLinks}}

## 리뷰
{{reviewLink}}

## 노트
{{noteLink}}

## 자막
{{scriptLink}}
`;
    }
  }

  async fetchAttachments(classId, lectureSlug) {
    try {
      console.log(`Fetching attachments for classId: ${classId}, lectureSlug: ${lectureSlug}`);
      const url = `${this.settings.baseUrl}/api/files/${classId}/${lectureSlug}`;
      console.log('Fetching from URL:', url);

      const response = await fetch(url);
      console.log('Response status:', response.status);

      if (!response.ok) {
        console.log('Response not OK:', response.statusText);
        if (response.status === 404) {
          console.log('No attachments found');
          return [];
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Fetched data:', data);

      if (!data.files || !Array.isArray(data.files)) {
        console.log('No files array in response');
        return [];
      }

      // '@'나 '.'으로 시작하는 파일 제외하고 필터링
      const filteredFiles = data.files.filter((file) => !file.startsWith('@') && !file.startsWith('.'));

      console.log('Filtered files:', filteredFiles);

      return filteredFiles;
    } catch (error) {
      console.error(`Error fetching attachments for lecture ${lectureSlug}:`, error);
      // 에러가 발생해도 빈 배열 반환하여 계속 진행
      return [];
    }
  }

  // YAML 값의 특수문자를 이스케이프 처리하는 메서드
  escapeYamlValue(value, isTitle = false) {
    if (typeof value !== 'string') return value;

    if (isTitle) {
      // title의 경우 큰따옴표를 작은따옴표로 변경하고 전체를 큰따옴표로 감싸기
      value = value.replace(/"/g, "'");
      return `"${value}"`;
    }

    // 특수문자가 포함된 경우 따옴표로 감싸기
    if (/[[\]{}:,"'#|>&*!]/.test(value)) {
      // 따옴표 이스케이프
      value = value.replace(/"/g, '\\"');
      return `"${value}"`;
    }

    return value;
  }

  async createLectureMarkdown(data) {
    const {
      lecture,
      classTitle,
      noteTitle,
      source,
      category,
      sanitizedClassTitle,
      hasNoteContent,
      prevNoteTitle,
      nextNoteTitle,
      classId,
    } = data;

    const tags = category ? `class101/${category.replace(/\s+/g, '')}` : 'class101';

    const videoUrl = `${this.settings.baseUrl}/lecture/class101/${sanitizedClassTitle}/${noteTitle}.mkv`;

    // 첨부 파일 목록 가져오기
    const lectureSlug = this.getLectureSlug(lecture);
    const attachments = await this.fetchAttachments(classId, lectureSlug);
    const attachmentsList =
      attachments.length > 0
        ? '\n' +
          attachments
            .map((url) => {
              const fileName = decodeURIComponent(url.split('/').pop());
              return `  - "${fileName}"`;
            })
            .join('\n')
        : '';

    // 각종 링크 생성
    const noteLink = hasNoteContent ? `[[${noteTitle}_note|수업 노트]]` : '수업 노트 없음';

    const reviewLink = `[[${noteTitle}_review|리뷰 작성]]`;

    const scriptLink = `[[${noteTitle}_script|자막 보기]]`;

    // 이전/다음 강의 링크 생성
    const prevLink = prevNoteTitle ? `[[${prevNoteTitle}|← 이전 강의]]` : '';
    const nextLink = nextNoteTitle ? `[[${nextNoteTitle}|다음 강의 →]]` : '';
    const navigationLinks = [prevLink, `[[${sanitizedClassTitle}|❖ 전체 목록]]`, nextLink]
      .filter((link) => link)
      .join(' | ');

    // 템플릿 가져오기
    const template = await this.getLectureTemplate();

    // 템플릿 변수 치환 (frontmatter 값들은 이스케이프 처리)
    return template
      .replace('{{title}}', this.escapeYamlValue(lecture.title, true))
      .replace('{{source}}', this.escapeYamlValue(source))
      .replace('{{duration}}', this.escapeYamlValue(this.formatDuration(lecture.duration)))
      .replace('{{category}}', this.escapeYamlValue(category))
      .replace('{{tags}}', this.escapeYamlValue(tags))
      .replace('{{videoUrl}}', videoUrl)
      .replace('{{navigationLinks}}', navigationLinks)
      .replace('{{reviewLink}}', reviewLink)
      .replace('{{noteLink}}', noteLink)
      .replace('{{scriptLink}}', scriptLink)
      .replace('{{attachments}}', attachmentsList);
  }

  formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(
        2,
        '0'
      )}`;
    }
    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  }

  async getScriptContent(lecture, sanitizedClassTitle, noteTitle) {
    try {
      const scriptUrl = `${this.settings.baseUrl}/lecture/class101/${sanitizedClassTitle}/${noteTitle}.vtt`;
      const response = await fetch(scriptUrl);
      if (!response.ok) {
        console.log(`Script not found for lecture ${noteTitle}`);
        return null;
      }
      const vttContent = await response.text();
      return this.parseVTT(vttContent);
    } catch (error) {
      console.error('Error getting script content:', error);
      return null;
    }
  }

  parseVTT(vttContent) {
    try {
      const lines = vttContent.split('\n');
      let markdown = '';
      let currentText = '';
      let isHeader = true;

      for (const line of lines) {
        // VTT 헤더 건너뛰기
        if (isHeader) {
          if (line.trim() === '') {
            isHeader = false;
          }
          continue;
        }

        // 숫자만 있는 라인(큐 번호) 건너뛰기
        if (/^\d+$/.test(line.trim())) {
          continue;
        }

        // 타임스탬프 라인 건너뛰기
        if (line.includes('-->')) {
          continue;
        }

        // 빈 줄 건너뛰기
        if (line.trim() === '') {
          continue;
        }

        // X-TIMESTAMP-MAP 라인 건너뛰기
        if (line.includes('X-TIMESTAMP-MAP')) {
          continue;
        }

        // 텍스트 라인 처리
        currentText = line.trim();
        if (currentText) {
          markdown += currentText + '\n';
        }
      }

      return markdown.trim();
    } catch (error) {
      console.error('Error parsing VTT:', error);
      return '';
    }
  }

  async createClassIndexContent(data) {
    const { classTitle, noteTitles, category, sanitizedClassTitle } = data;

    try {
      // HTML 데이터 가져오기
      const homeUrl = `${this.settings.baseUrl}/lecture/_repo/class101/html/classes/${this.currentClassId}/home.html`;
      const response = await fetch(homeUrl);
      const html = await response.text();

      // HTML 파싱
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // 크리에이터 섹션에서 정확한 CSS 클래스를 가진 h2 태그로 이름 추출
      const creatorSection = doc.querySelector('section#creator');
      const creatorElement = creatorSection?.querySelector('h2[data-testid="title"].css-ab1zeh');
      const creatorName = creatorElement ? creatorElement.textContent.trim() : 'Unknown Creator';
      const sanitizedCreatorName = this.sanitizeName(creatorName);

      // 각 섹션별 마크다운 파일 생성
      await this.createSectionFiles({
        html,
        classId: this.currentClassId,
        sanitizedClassTitle,
        creatorName,
        basePath: this.settings.rootDir,
      });

      // 강의 목록 생성
      const lectureList = noteTitles.map((noteTitle) => `### [[${noteTitle}]]`).join('\n\n');

      // source URL 생성
      const source = `https://class101.net/ko/classes/${this.currentClassId}`;

      return `---
title: "${classTitle}"
source: ${source}
category: ${category}
tags: 
  - class101/class
---

## 클래스 소개

[[${sanitizedClassTitle}_intro|클래스 소개]]


## 준비물

[[${sanitizedClassTitle}_kit|준비물]]


## 커리큘럼

${lectureList}


## 크리에이터

[[${sanitizedCreatorName}_creator|${creatorName}]]`;
    } catch (error) {
      console.error('Error creating class index content:', error);
      throw error;
    }
  }

  async createSectionFiles({ html, classId, sanitizedClassTitle, creatorName, basePath }) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const sanitizedCreatorName = this.sanitizeName(creatorName);

    // 이미지 URL에서 ID 추출하는 함수
    const extractImageId = (srcset) => {
      const match = srcset.match(/images\/([^\/]+)/);
      return match ? match[1] : null;
    };

    // 이미지 처리 함수
    const processImages = (content) => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(content, 'text/html');

      // picture 태그 찾기
      const pictures = doc.querySelectorAll('picture');
      pictures.forEach((picture) => {
        const source = picture.querySelector('source');
        if (source && source.getAttribute('srcset')) {
          const imageId = extractImageId(source.getAttribute('srcset'));
          if (imageId) {
            const markdown = `![${imageId}](https://cdn.class101.net/images/${imageId}/1080xauto.webp)`;
            picture.outerHTML = markdown;
          }
        }
      });

      return doc.body.innerHTML;
    };

    // 각 섹션별 파일 생성
    const sections = [
      {
        id: 'class_description',
        folder: 'intros',
        filename: `${sanitizedClassTitle}_intro.md`,
        title: '클래스 소개',
        process: processImages,
      },
      {
        id: 'kit',
        folder: 'kits',
        filename: `${sanitizedClassTitle}_kit.md`,
        title: '준비물',
        process: (content) => {
          // '더보기' 버튼 제거
          content = content.replace(/<button[^>]*>더보기<\/button>/g, '');
          // 마지막 '더보기' 텍스트 제거
          content = content.replace(/더보기\s*$/, '');
          return content;
        },
      },
      {
        id: 'creator',
        folder: 'creators',
        filename: `${sanitizedCreatorName}_creator.md`,
        title: creatorName,
        process: processImages,
      },
    ];

    for (const section of sections) {
      try {
        // 섹션 내용 추출
        const sectionElement = doc.querySelector(`section#${section.id}`);
        if (!sectionElement) {
          console.log(`Section ${section.id} not found`);
          continue;
        }

        // 섹션별 특수 처리 적용
        let processedHtml = section.process(sectionElement.outerHTML);

        // 마크다운으로 변환
        let markdown = await this.convertHtmlToMarkdown(processedHtml);

        // '### 수업 노트' 제거
        markdown = markdown.replace(/### 수업 노트\n*/g, '');

        // 빈 헤더나 리스트 항목 제거
        markdown = markdown
          .split('\n')
          .filter((line) => {
            const trimmedLine = line.trim();
            return !(trimmedLine === '###' || trimmedLine === '-' || trimmedLine === '##' || trimmedLine === '#');
          })
          .join('\n');

        // 연속된 빈 줄 제거
        markdown = markdown.replace(/\n{3,}/g, '\n\n');

        // 폴더 생성
        const folderPath = path.join(basePath, section.folder);
        await this.ensureFolder(folderPath);

        // 파일 생성
        const filePath = path.join(folderPath, section.filename);
        const content = `---
title: ${section.title}
tags:
  - class101/${section.folder}
---

${markdown.trim()}`;

        await this.createFileWithOverwriteCheck(filePath, content);
      } catch (error) {
        console.error(`Error creating ${section.title} file:`, error);
      }
    }
  }

  // 깨진 한글 문자를 복원하는 메서드
  fixBrokenKorean(text) {
    try {
      // 깨진 문자 패턴 확인
      if (!/[ì|í|ë|ê|å|ã]/.test(text)) {
        return text;
      }

      // ISO-8859-1로 잘못 해석된 UTF-8 문자를 다시 바이트로 변환
      const bytes = text.split('').map((char) => char.charCodeAt(0));

      // UTF-8로 디코딩
      const decoded = new TextDecoder('utf-8').decode(new Uint8Array(bytes));

      return decoded;
    } catch (error) {
      console.error('Error fixing broken Korean:', error);
      return text;
    }
  }

  async convertHtmlToMarkdown(html, attachments = []) {
    try {
      if (!html) return '';

      // HTML 정리
      const cleanHtml = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '');

      // DOM 파서 생성
      const parser = new DOMParser();
      const doc = parser.parseFromString(cleanHtml, 'text/html');

      // 첨부 파일 섹션 제거
      const attachmentHeaders = doc.evaluate(
        "//h3[contains(text(), '첨부')]",
        doc,
        null,
        XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE,
        null
      );

      for (let i = 0; i < attachmentHeaders.snapshotLength; i++) {
        const header = attachmentHeaders.snapshotItem(i);
        let currentNode = header;
        while (
          currentNode &&
          currentNode.nextElementSibling &&
          !currentNode.nextElementSibling.textContent.trim().startsWith('수업 노트')
        ) {
          const nextNode = currentNode.nextElementSibling;
          currentNode.parentNode.removeChild(currentNode);
          currentNode = nextNode;
        }
        if (currentNode) {
          currentNode.parentNode.removeChild(currentNode);
        }
      }

      // 마크다운으로 변환
      const processNode = (node) => {
        if (!node) return '';

        if (node.nodeType === 3) {
          // 텍스트 노드
          const text = node.textContent.trim();
          return text ? text + ' ' : '';
        }

        if (node.nodeType !== 1) {
          // 요소 노드가 아닌 경우
          return '';
        }

        const tagName = node.tagName.toLowerCase();
        let result = '';

        // 자식 노드들의 내용을 재귀적으로 처리
        const childContent = Array.from(node.childNodes)
          .map((child) => processNode(child))
          .join('')
          .trim();

        switch (tagName) {
          case 'h1':
            result = `# ${childContent}\n\n`;
            break;
          case 'h2':
            result = `## ${childContent}\n\n`;
            break;
          case 'h3':
            result = `### ${childContent}\n\n`;
            break;
          case 'h4':
            result = `#### ${childContent}\n\n`;
            break;
          case 'h5':
            result = `##### ${childContent}\n\n`;
            break;
          case 'h6':
            result = `###### ${childContent}\n\n`;
            break;
          case 'p':
            result = `${childContent}\n\n`;
            break;
          case 'strong':
          case 'b':
            result = ` **${childContent}** `;
            break;
          case 'em':
          case 'i':
            result = ` *${childContent}* `;
            break;
          case 'a':
            const href = node.getAttribute('href');
            result = href ? `[${childContent}](${href})` : childContent;
            break;
          case 'img':
            const src = node.getAttribute('src');
            const alt = this.fixBrokenKorean(node.getAttribute('alt') || '');
            result = src ? `![${alt}](${src})\n\n` : '';
            break;
          case 'ul':
            result =
              Array.from(node.children)
                .map((li) => `- ${processNode(li)}`)
                .join('\n\n') + '\n\n';
            break;
          case 'ol':
            result =
              Array.from(node.children)
                .map((li, index) => `${index + 1}. ${processNode(li)}`)
                .join('\n\n') + '\n\n';
            break;
          case 'li':
            result = childContent;
            break;
          case 'br':
            result = '\n\n';
            break;
          case 'code':
            result = `\`${childContent}\``;
            break;
          case 'pre':
            result = `\`\`\`\n${childContent}\n\`\`\`\n\n`;
            break;
          case 'blockquote':
            result = `> ${childContent}\n\n`;
            break;
          case 'div':
            result = `${childContent}\n\n`;
            break;
          default:
            result = childContent;
        }

        return result;
      };

      // 본문 내용을 마크다운으로 변환
      let markdown = '';

      // 첨부 파일 섹션 추가 (있는 경우에만)
      if (attachments.length > 0) {
        markdown += `### 첨부 파일\n\n${attachments
          .map((fileName) => {
            const encodedFileName = encodeURIComponent(fileName);
            return `[${fileName}](${this.settings.baseUrl}/lecture/_repo/class101/html/classes/${this.currentClassId}/${this.currentLectureSlug}/files/${encodedFileName})`;
          })
          .join('\n\n')}\n\n`;
      }

      // 수업 노트 섹션 추가
      markdown += '### 수업 노트\n\n';

      // 전체 내용 처리 (수업 노트 제목 제외)
      const content = processNode(doc.body);
      markdown += content.replace(/### 수업 노트\n\n/g, '');

      // 마지막 정리
      markdown = markdown
        .replace(/\*\*([^*\n]+)\*\*(\s*)\*\*/g, ' **$1** ') // 중복된 강조 제거 및 공백 추가
        .replace(/\n{3,}/g, '\n\n') // 연속된 줄바꿈 정리
        .replace(/\s+\n/g, '\n') // 줄 끝의 공백 제거
        .replace(/\n\s+/g, '\n') // 줄 시작의 공백 제거
        .replace(/([^\n])\n([^\n])/g, '$1\n\n$2') // 단일 줄바꿈을 이중 줄바꿈으로 변경
        .replace(/^\s+|\s+$/g, '') // 시작과 끝의 공백 제거
        .replace(/(!\[[^\]]*\]\([^)]+\))([^\n])/g, '$1\n\n$2'); // 이미지 링크 뒤에 줄바꿈 추가

      return markdown.trim();
    } catch (error) {
      console.error('Error converting HTML to Markdown:', error);
      return '';
    }
  }

  // 파일 생성 전에 overwrite 설정을 확인하는 메서드 추가
  async createFileWithOverwriteCheck(filePath, content) {
    const exists = await this.app.vault.adapter.exists(filePath);
    if (exists && !this.settings.overwrite) {
      throw new Error(`파일이 이미 존재합니다: ${filePath}`);
    }
    await this.app.vault.create(filePath, content);
  }

  async processAllClasses() {
    try {
      new Notice('서버에서 클래스 목록을 가져오는 중...');

      // myclassIds.json 파일에서 classId 배열 가져오기
      const response = await fetch(`${this.settings.baseUrl}/lecture/_repo/class101/json/myclassIds.json`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const classIds = await response.json();

      if (!Array.isArray(classIds) || classIds.length === 0) {
        new Notice('처리할 클래스가 없습니다.');
        return;
      }

      new Notice(`${classIds.length}개의 클래스를 처리합니다...`);

      // 각 classId에 대해 처리
      for (const classId of classIds) {
        try {
          new Notice(`클래스 처리 중: ${classId}`);
          await this.generateMarkdown(classId);
        } catch (error) {
          console.error(`Error processing class ${classId}:`, error);
          new Notice(`클래스 처리 중 오류 발생: ${classId}`);
        }
      }

      new Notice('모든 클래스 처리가 완료되었습니다.');
    } catch (error) {
      console.error('Error in processAllClasses:', error);
      new Notice('클래스 처리 중 오류가 발생했습니다.');
    }
  }

  async processInFile() {
    try {
      // 현재 활성화된 파일 가져오기
      const activeFile = this.app.workspace.getActiveFile();
      if (!activeFile) {
        new Notice('처리할 파일이 선택되지 않았습니다.');
        return;
      }

      // 파일 내용 읽기
      const content = await this.app.vault.read(activeFile);
      console.log('파일 내용:', content);

      // 줄 단위로 분리하고 유효한 classId/URL만 필터링
      const lines = content.split('\n').map((line) => line.trim().replace(/\s+/g, '')); // 공백 제거
      console.log('분리된 줄:', lines);

      const validLines = lines.filter((line) => {
        const isValid =
          line.length > 20 && // 20자 초과인 경우만 허용
          /^[a-zA-Z0-9\/:]+$/.test(line);
        console.log(`라인 "${line}": 길이=${line.length}, 유효성=${isValid}`);
        return isValid;
      });

      console.log('유효한 줄:', validLines);

      if (validLines.length === 0) {
        new Notice('처리할 유효한 classId/URL이 없습니다.');
        return;
      }

      new Notice(`${validLines.length}개의 클래스를 처리합니다...`);

      // 각 줄에 대해 처리
      for (const line of validLines) {
        try {
          const classId = this.extractClassId(line);
          console.log(`처리 중인 라인: "${line}", 추출된 classId: ${classId}`);
          if (classId) {
            new Notice(`클래스 처리 중: ${classId}`);
            await this.generateMarkdown(classId);
          }
        } catch (error) {
          console.error(`Error processing class ${line}:`, error);
          new Notice(`클래스 처리 중 오류 발생: ${line}`);
        }
      }

      new Notice('모든 클래스 처리가 완료되었습니다.');
    } catch (error) {
      console.error('Error in processInFile:', error);
      new Notice('클래스 처리 중 오류가 발생했습니다.');
    }
  }

  // 클래스 목록 생성 함수
  async createClassList() {
    try {
      new Notice('클래스 목록을 생성하고 있습니다...');

      // JSON 데이터 가져오기
      const jsonUrl = `${this.settings.baseUrl}/lecture/_repo/class101/json/myclasses.json`;
      const response = await fetch(jsonUrl);
      const classes = await response.json();

      // 테이블 헤더 생성
      let tableContent = '| 제목 | 카테고리 | 크리에이터 | 링크 |\n';
      tableContent += '|------|-----------|------------|------|\n';

      // 클래스 정보로 테이블 행 생성
      for (const classInfo of classes) {
        const title = classInfo.title.replace(/\|/g, '\\|'); // 파이프 문자 이스케이프
        const category = classInfo.categoryTitle?.replace(/\|/g, '\\|') || '';
        const creator = classInfo.creatorName?.replace(/\|/g, '\\|') || '';
        const link = `[[${this.sanitizeName(title)}|🔗]]`;

        tableContent += `| ${title} | ${category} | ${creator} | ${link} |\n`;
      }

      // 마크다운 파일 생성
      const content = `---
title: class101
tags: 
  - lecture/class101
---

## 클래스 목록

${tableContent}`;

      // 파일 저장
      const filePath = path.join(this.settings.rootDir, 'myclasses.md');
      await this.createFileWithOverwriteCheck(filePath, content);

      new Notice('클래스 목록이 생성되었습니다.');
    } catch (error) {
      console.error('Error creating class list:', error);
      new Notice('클래스 목록 생성 중 오류가 발생했습니다.');
    }
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

    containerEl.createEl('h2', { text: 'Class101 설정' });

    new Setting(containerEl)
      .setName('루트 디렉토리')
      .setDesc('Class101 강의 노트가 저장될 기본 경로입니다.')
      .addText((text) =>
        text
          .setPlaceholder('예: 33. RESOURCES/Lectures/class101')
          .setValue(this.plugin.settings.rootDir)
          .onChange(async (value) => {
            this.plugin.settings.rootDir = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('기본 URL')
      .setDesc('Class101 API 서버의 기본 URL입니다.')
      .addText((text) =>
        text
          .setPlaceholder('예: http://125.133.148.194:4000')
          .setValue(this.plugin.settings.baseUrl)
          .onChange(async (value) => {
            this.plugin.settings.baseUrl = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('템플릿 디렉토리')
      .setDesc('템플릿 파일들이 저장된 디렉토리 경로입니다.')
      .addText((text) =>
        text
          .setPlaceholder('예: 93. templates/class101')
          .setValue(this.plugin.settings.templateDir)
          .onChange(async (value) => {
            this.plugin.settings.templateDir = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('파일 덮어쓰기')
      .setDesc('파일이 이미 존재할 경우 덮어쓸지 여부를 설정합니다.')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.overwrite).onChange(async (value) => {
          this.plugin.settings.overwrite = value;
          await this.plugin.saveSettings();
        })
      );

    // 하위 디렉토리 설정
    const subDirs = [
      { key: 'lectureFolder', name: '강의', desc: '강의 파일' },
      { key: 'reviewFolder', name: '리뷰', desc: '리뷰 파일' },
      { key: 'noteFolder', name: '노트', desc: '노트 파일' },
      { key: 'scriptFolder', name: '자막', desc: '자막 파일' },
      { key: 'classFolder', name: '클래스', desc: '클래스 파일' },
    ];

    subDirs.forEach(({ key, name, desc }) => {
      new Setting(containerEl)
        .setName(`${name} 폴더`)
        .setDesc(`${desc}이 저장될 하위 경로입니다.`)
        .addText((text) =>
          text
            .setPlaceholder(`예: ${key.replace('Folder', '')}`)
            .setValue(this.plugin.settings[key])
            .onChange(async (value) => {
              this.plugin.settings[key] = value;
              await this.plugin.saveSettings();
            })
        );
    });
  }
}

module.exports = Class101Plugin;
