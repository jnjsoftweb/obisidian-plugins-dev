(() => {
    const scriptUrl = URL.createObjectURL(
      new Blob(
        ["https://cdnjs.cloudflare.com/ajax/libs/turndown/7.1.2/turndown.min.js"],
        { type: "text/javascript" }
      )
    );
  
    const trustedUrl = trustedTypes.createURL(scriptUrl); // Assuming Trusted Types is enabled
  
    const script = document.createElement("script");
    script.src = trustedUrl;
    document.head.appendChild(script);
  
    script.src =
      "https://cdnjs.cloudflare.com/ajax/libs/turndown/7.1.2/turndown.min.js";
    document.head.appendChild(script);
  
    script.onload = () => {
      const turndownService = new TurndownService({
        headingStyle: "atx",
        codeBlockStyle: "fenced",
      });
  
      // button 태그 제거 규칙 추가
      turndownService.addRule("button", {
        filter: "button",
        replacement: function (content, node) {
          return "";
        },
      });
  
      // pre 태그 처리 규칙 (필요한 경우)
      turndownService.addRule("pre", {
        filter: ["pre"],
        replacement: function (content, node) {
          // pre > div > div[1] 요소의 텍스트 무시
          const languageDiv = node.querySelector("div > div:first-child");
          if (languageDiv) {
            languageDiv.remove();
          }
  
          let language =
            node.querySelector("code")?.className?.match(/language-(\w+)/)?.[1] ||
            "";
  
          language = language.replace(/markdown/i, "");
          language = language.trim();
  
          let code = node.querySelector("code")?.textContent || "";
          code = code.trim();
          return `\n\`\`\`${language}\n${code}\n\`\`\`\n\n`;
        },
      });
  
      // code 태그 처리 규칙 (userMessage 용)
      turndownService.addRule("code-user-message", {
        filter: function (node, options) {
          return (
            node.parentNode.closest('[data-testid="user-message"]') &&
            node.nodeName === "CODE"
          );
        },
        replacement: function (content, node) {
          let codeContent = "";
          node.childNodes.forEach((child) => {
            if (child.nodeType === Node.TEXT_NODE) {
              codeContent += child.textContent;
            } else if (child.nodeName === "SPAN") {
              codeContent += child.textContent + "\n";
            }
          });
          return `\n\`\`\`\n${codeContent.trim()}\n\`\`\`\n\n`; // 마지막에 \n\n 추가
        },
      });
  
      // p 태그 처리 규칙 (userMessage 용)
      turndownService.addRule("p-user-message", {
        filter: function (node, options) {
          return (
            node.parentNode.closest('[data-testid="user-message"]') &&
            node.nodeName === "P"
          );
        },
        replacement: function (content, node) {
          content = content.replace(/<a[^>]*>|<\/a>/g, "");
          return content + "\n\n"; // p 태그 후 줄바꿈 두 번 추가
        },
      });
  
      let markdownContent = "";
  
      const userMessages = document.querySelectorAll("user-query");
      const claudeResponses = document.querySelectorAll("model-response");
  
      for (let i = 0; i < userMessages.length; i++) {
        markdownContent += "## user prompt\n\n";
        markdownContent += convertUserMessageToMarkdown(userMessages[i]); // user message 변환
        // markdownContent += `${turndownService.turndown(
        //   userMessages[i].innerHTML
        // )}\n\n`;
        markdownContent += "## claude says\n\n";
  
        if (claudeResponses[i]) {
          markdownContent += `${turndownService.turndown(
            claudeResponses[i].innerHTML
          )}\n\n`;
        } else {
          markdownContent += "답변 없음\n\n";
        }
  
        markdownContent += "---\n\n";
      }
  
      function convertUserMessageToMarkdown(userMessageNode) {
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
  
      const blob = new Blob([markdownContent], { type: "text/markdown" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "claude_chat.md";
      link.click();
    };
  })();
  