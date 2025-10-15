import fs from "fs";
import { connect } from "puppeteer-real-browser";

const baseUrl = "https://www.yelp.com/search?";

export async function getCookies(location, desc) {
  const index = 0;
  const params = `find_desc=${desc}&find_loc=${location}&start=${index}`;
  const searchUrl = baseUrl + params;
  const { browser } = await connect({
    defaultViewport: null,
    headless: false,

    args: [],

    customConfig: {},

    turnstile: true,

    connectOption: {
      defaultViewport: null,
    },
    disableXvfb: false,
    ignoreAllFlags: false,
    // proxy:{
    //     host:'<proxy-host>',
    //     port:'<proxy-port>',
    //     username:'<proxy-username>',
    //     password:'<proxy-password>'
    // }
  });

  const oldCookies = JSON.parse(fs.readFileSync("cookies.json", "utf-8"));
  if (oldCookies.length != 0) {
    await browser.setCookie(...oldCookies);
  }
  const page = await browser.newPage();
  await page.goto(searchUrl);
  await new Promise((res) => setTimeout(res, 10000));

  const cookies = await browser.cookies();
  fs.writeFileSync("cookies.json", JSON.stringify(cookies, null, 2));
  console.log("cookies saved");

  await browser.close();
}

// getCookies("california", "roofers");
