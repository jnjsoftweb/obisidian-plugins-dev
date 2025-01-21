import { saveFile } from 'jnj-utils';
// import { convertClaudeHtmlToMarkdown } from "./turndown.js";
import { fetchFromOpenai } from './historyOpenai.js';
import { fetchFromClaude } from './historyClaude.js';
import { fetchFromGenspark } from './historyGenspark.js';
import { fetchFromPerplexity } from './hitoryPerplexity.js';

// const targetUrl = "https://claude.ai/chat/a9d32c70-f740-4a54-ae5d-49ee72423018";
// const result = await fetchFromClaude(targetUrl);

// const html = result.source;
// saveFile("./downloads/claude.html", html);
// // const markdown = convertClaudeHtmlToMarkdown(html);
// // saveFile("./downloads/claude.md", markdown);

// * Openai
// // const targetUrl = "https://chatgpt.com/c/67821379-a400-8012-899f-2f2b05178b1f";
// const targetUrl = "https://chatgpt.com/c/677cb31f-c5e0-8012-863e-bfc44922a3ff";
// const result = await fetchFromOpenai(targetUrl);
// const { title, content, markdown } = result;
// saveFile(`./downloads/openai_${title}.html`, content);
// saveFile(`./downloads/openai_${title}.md`, markdown);

// * Claude
//
const targetUrl = 'https://claude.ai/chat/b911c05c-ea42-4f91-b536-b3b197e659ce';
const result = await fetchFromClaude(targetUrl);
const { title, content, markdown } = result;
saveFile(`./downloads/claude_${title}.html`, content);
saveFile(`./downloads/claude_${title}.md`, markdown);

// // * Genspark
// // const targetUrl = 'https://www.genspark.ai/agents?id=39f72fcf-a452-4997-b5dc-4f5da8f0227a';
// const targetUrl = 'https://www.genspark.ai/agents?id=ca74f391-0f6a-4c04-b615-7f05c54903c1';
// const result = await fetchFromGenspark(targetUrl);
// const { title, content, markdown } = result;
// saveFile(`./downloads/genspark_${title}.html`, content);
// saveFile(`./downloads/genspark_${title}.md`, markdown);

// // * Perplexity
// const targetUrl = 'https://www.perplexity.ai/search/obsidieoneseo-youtube-dongyeon-qJf_5eW5QV2TszP3tpApkg';
// // https://www.perplexity.ai/search/obsidieoneseo-youtube-dongyeon-qJf_5eW5QV2TszP3tpApkg
// const result = await fetchFromPerplexity(targetUrl);
// const { title, content, markdown } = result;

// // 파일명 안전하게 저장
// const safeTitle = title.replace(/[\\/:*?"<>|\n\r]/g, '').trim();
// saveFile(`./downloads/perplexity_${safeTitle}.html`, content);
// saveFile(`./downloads/perplexity_${safeTitle}.md`, markdown);
