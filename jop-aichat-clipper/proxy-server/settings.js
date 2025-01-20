import dotenv from "dotenv";

dotenv.config();

const { YOUTUBE_API_URL, YOUTUBE_API_KEY, GOOGLE_EMAIL, CHROME_USER_DATA_DIR } = process.env;
const defaultEmail = GOOGLE_EMAIL;

const chromeOptions = {
  default: {
    headless: false,
    email: GOOGLE_EMAIL,
    userDataDir: CHROME_USER_DATA_DIR,
  },
  daum: {
    headless: false,
    email: GOOGLE_EMAIL,
    userDataDir: CHROME_USER_DATA_DIR,
  },
};

const selectors = {
  poordoctor: {
    title: "#primaryContent > div.bbs_read_tit > strong > span",
    author: "#primaryContent > div.bbs_read_tit > div.info_desc > div.cover_info > a",
    views: "#primaryContent > div.bbs_read_tit > div.info_desc > div.cover_info > span:nth-child(2)",
    content: "#bbs_contents",
  },
};

export { selectors, chromeOptions, defaultEmail };
