import { main } from "./getData.js";
import { getCookies } from "./render.js";
import fs from "fs";
import Papa from "papaparse";

const desc = "Roofers";
const fileLocation = "C:\\Users\\itsro\\Downloads\\ca.csv";

//
function csvToJson(csvFilePath) {
  const file = fs.readFileSync(csvFilePath, "utf8");
  const result = Papa.parse(file, {
    header: false, // use the first line as headers
    skipEmptyLines: true,
  });
  return result.data;
}

async function start() {
  const locationsArray = csvToJson(fileLocation);
  if (locationsArray.length == 0) {
    throw new Error(`CSV is empty : ${fileLocation}`);
  }
  await getCookies(locationsArray[0], desc);
  for (const location of locationsArray) {
    console.log(`running for location ${location}`);
    await main(location, desc, `${desc} in ${location}.xlsx`);
  }
}

start();
