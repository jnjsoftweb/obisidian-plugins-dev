(() => {
    // * chatgpt
    // const userMessageSelector = "article:nth-child(even)";
    // const modelResponseSelector = "article:nth-child(odd)";
    // * claude
    // const userMessageSelector = '[data-testid="user-query"]';
    // const modelResponseSelector = "[data-test-render-count]:nth-child(even)";
    // * gemini
    const userMessageSelector = "user-query";
    const modelResponseSelector = "model-response";
  
    let htmlContent = "";
  
    const userMessages = document.querySelectorAll(userMessageSelector);
    const modelResponses = document.querySelectorAll(modelResponseSelector);
  
    for (let i = 0; i < userMessages.length; i++) {
      htmlContent += "<user-query>\n";
      htmlContent += `${userMessages[i].innerHTML}\n`; // user message 변환
      htmlContent += "</user-query>\n\n";
      htmlContent += "<model-response>\n";
  
      if (modelResponses[i]) {
        htmlContent += `${modelResponses[i].innerHTML}\n`; // user message 변환
      }
  
      htmlContent += "</model-response>\n\n";
    }
  
    const blob = new Blob([htmlContent], { type: "text/html" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "chat.html";
    link.click();
  })();
  