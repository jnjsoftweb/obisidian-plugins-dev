## 클래스 홈페이지 적용

- 아래의 createClassIndexContent 함수 내용을 ### data fetch, ### markdown path(저장 경로), ### markdown template 내용에 맞춰 수정해주세요.

```
  createClassIndexContent(data) {
    const { classTitle, noteTitles, category, sanitizedClassTitle } = data;

    const lectureList = noteTitles.map((noteTitle) => `### [[${noteTitle}]]`).join('\n\n');

    return `---
title: ${classTitle}
category: ${category}
tags: class101
---

## 강의 목록

${lectureList}
`;
  }
```

### data fetch(html 데이터 소스)
- syntax: ${this.settings.baseUrl}/lecture/_repo/class101/html/classes/${this.currentClassId}/home.html
- example: http://125.133.148.194:4000/lecture/_repo/class101/html/classes/5c9bb8739eff0eeadb23aec1/home.html

### markdown path(저장 경로)

- 33. RESOURCES/Lecures/class101/classes/{className}.md


### markdown template

~~~
---
title: {{title}}
source: {{source}}
category: {{category}}
tags: 
  - class101/class
---

## 클래스 소개

[[{{className}}_intro|클래스 소개]]


## 준비물

[[{{className}}_kit|준비물]]


## 커리큘럼

{{lectureList}}


## 크리에이터

[[{{creator}}_creator|크리에이터]]
~~~

### 클래스 소개
  - 노트 제목: {{className}}_intro
  - 파일 경로: 33. RESOURCES/Lecures/class101/intros/{className}_intro.md
  - 파일 내용:
  - 원본 html: ${this.settings.baseUrl}/lecture/_repo/class101/html/classes/${this.currentClassId}/home.html
  - 원본 html 중 클래스 소개 부분(`<section id="class_description">`)을 추출해서 markdown 파일에 저장

### 준비물
- 노트 제목: {{className}}_kit
- 파일 경로: 33. RESOURCES/Lecures/class101/kits/{className}_kit.md
- 파일 내용:
- 원본 html: ${this.settings.baseUrl}/lecture/_repo/class101/html/classes/${this.currentClassId}/home.html
- 원본 html 중 준비물 부분(`<section id="kit">`)을 추출해서 markdown 파일에 저장

### 크리에이터
- 노트 제목: {{creator}}_creator
- 파일 경로: 33. RESOURCES/Lecures/class101/creators/{creator}_creator.md
- 파일 내용:
- 원본 html: ${this.settings.baseUrl}/lecture/_repo/class101/html/classes/${this.currentClassId}/home.html
- 원본 html 중 크리에이터 부분(`<section id="creator">`)을 추출해서 markdown 파일에 저장

----


### 클래스 소개
1. 프론트매터 다음에 나오는 `### 수업 노트` 삭제
2. 이미지 링크 markdown 복구
아래와 같은 경우
`![78331fe9-a4d2-40b0-8594-8196a2bd79af](https://cdn.class101.net/images/78331fe9-a4d2-40b0-8594-8196a2bd79af/1080xauto.webp)`
로 복구
3. 한 줄에 '###',  '-' 와 같이 실제 내용이 없는 라인 삭제

```
<picture data-testid="image" class="css-eti150"
  ><source
    type="image/webp"
    srcset="
      https://cdn.class101.net/images/78331fe9-a4d2-40b0-8594-8196a2bd79af/128xauto.webp   128w,
      https://cdn.class101.net/images/78331fe9-a4d2-40b0-8594-8196a2bd79af/320xauto.webp   320w,
      https://cdn.class101.net/images/78331fe9-a4d2-40b0-8594-8196a2bd79af/640xauto.webp   640w,
      https://cdn.class101.net/images/78331fe9-a4d2-40b0-8594-8196a2bd79af/750xauto.webp   750w,
      https://cdn.class101.net/images/78331fe9-a4d2-40b0-8594-8196a2bd79af/828xauto.webp   828w,
      https://cdn.class101.net/images/78331fe9-a4d2-40b0-8594-8196a2bd79af/1080xauto.webp 1080w,
      https://cdn.class101.net/images/78331fe9-a4d2-40b0-8594-8196a2bd79af/1200xauto.webp 1200w,
      https://cdn.class101.net/images/78331fe9-a4d2-40b0-8594-8196a2bd79af/1920xauto.webp 1920w,
      https://cdn.class101.net/images/78331fe9-a4d2-40b0-8594-8196a2bd79af/2048xauto.webp 2048w,
      https://cdn.class101.net/images/78331fe9-a4d2-40b0-8594-8196a2bd79af/3840xauto.webp 3840w
    " />
  <img
    class="css-1u3hmek"
    draggable="false"
    alt=""
    loading="lazy"
/></picture>
```



### 준비물
1. 프론트매터 다음에 나오는 `### 수업 노트` 삭제
2. 마지막 '더보기' 삭제
3. 한 줄에 '###',  '-' 와 같이 실제 내용이 없는 라인 삭제



### 크리에이터
1. 프론트매터 다음에 나오는 `### 수업 노트` 삭제
2. 노트 제목이 'Unknown Creator_creator'로 되어 있음
- `<h2 data-testid="title" class="css-ab1zeh">그레이스캘리</h2>`와 같은 요소에서 '그레이스캘리'를 추출하고,
- 노트 제목을 '그레이스캘리_creator'로 변경
3. 한 줄에 '###',  '-' 와 같이 실제 내용이 없는 라인 삭제


---

## 클래스 목록 페이지

- 아래와 같이 class101 클래스(myclass) 목록 페이지를 추가 구현해주세요. 
- 기존 명령과는 별도의 명령으로 실행될 수 있도록 해주세요.


### data fetch(json 데이터 소스)
http://125.133.148.194:4000/lecture/_repo/class101/json/myclasses.json

### markdown path(저장 경로)

- 33. RESOURCES/Lecures/class101/myclasses.md

### markdown template

~~~
---
title: class101
tags: 
  - lecture/class101
---

## 클래스 목록

{{myclasses}}
~~~


`{{myclasses}}` 은 json 데이터를 표형식으로 나타내주세요.