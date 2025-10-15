import axios from "axios";
import fs from "fs";
import * as cheerio from "cheerio";
import xlsx from "xlsx";

const baseUrl = "https://www.yelp.com/search?";

const delay = 700;

async function fetchYelpHtml(location, desc, index = 0) {
  console.log("Extracting for index " + index);
  const params = `find_desc=${encodeURIComponent(
    desc
  )}&find_loc=${encodeURIComponent(location)}&start=${index}`;
  const searchUrl = baseUrl + params;

  // Read and format cookies
  const cookies = JSON.parse(fs.readFileSync("cookies.json", "utf8"));
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

  console.log(cookieHeader);
  try {
    const response = await axios.get(searchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Cache-Control": "no-cache",
        Cookie: cookieHeader,
      },
    });

    // ✅ Print or save the HTML
    const html = response.data;
    // fs.writeFileSync("content.html", response.data);
    return html;
    // fs.writeFileSync("yelp.html", response.data); // optional: save to file
  } catch (error) {
    console.error("❌ Error fetching Yelp page:", error.message);
    if (error.response) {
      console.log("Response code:", error.response.status);
      console.log("Response headers:", error.response.headers);
    }
  }
}

function extractReactRootProps(html) {
  const $ = cheerio.load(html);

  // Get all script tags
  const scripts = $("script");

  for (let i = 0; i < scripts.length; i++) {
    const scriptContent = $(scripts[i]).html();

    if (
      scriptContent &&
      scriptContent.includes("window.yelp.react_root_props")
    ) {
      // Regex to capture JSON after 'window.yelp.react_root_props ='
      const match = scriptContent.match(
        /window\.yelp\.react_root_props\s*=\s*(\{[\s\S]*?\})\s*;/
      );

      if (match && match[1]) {
        try {
          // Parse JSON safely
          const json = JSON.parse(match[1]);
          return json;
        } catch (err) {
          console.error(
            "⚠️ Failed to parse react_root_props JSON:",
            err.message
          );
        }
      }
    }
  }

  console.error("❌ react_root_props not found in HTML.");
  return null;
}

const getAllBizIds = (jsonData) => {
  const components =
    jsonData?.legacyProps?.searchAppProps?.searchPageProps
      ?.mainContentComponentsListProps;

  if (!Array.isArray(components)) {
    console.error(
      "Error: 'mainContentComponentsListProps' not found or is not an array."
    );
    return [];
  }

  const bizIds = components
    .flatMap((component) => {
      if (component.bizId && component.isAd !== true) {
        return component.bizId;
      }

      if (component.props && Array.isArray(component.props.searchResults)) {
        return component.props.searchResults
          .filter((result) => result.isAd !== true)
          .map((result) => result.bizId);
      }

      return [];
    })
    .filter((id) => id);

  return bizIds;
};

async function getJsonLinkedData(bizId) {
  let data = JSON.stringify([
    {
      operationName: "GetLocalBusinessJsonLinkedData",
      variables: {
        encBizId: bizId,
        FetchVideoMetadata: true,
        MediaItemsLimit: 25,
        ReviewsPerPage: 10,
        HasSelectedReview: false,
        SelectedReviewEncId: "",
        FetchBizSummaries: false,
      },
      extensions: {
        operationType: "query",
        documentId:
          "d12e33eedf3f020069c9c2317d23a3c6477edd1a947c88d4cbdac99da177b392",
      },
    },
  ]);

  let config = {
    method: "post",
    maxBodyLength: Infinity,
    url: "https://www.yelp.com/gql/batch",
    headers: {
      accept: "*/*",
      "accept-language": "en-US,en;q=0.9",
      "cache-control": "no-cache",
      "content-type": "application/json",
      origin: "https://www.yelp.com",
      pragma: "no-cache",
      priority: "u=1, i",
      referer: "https://www.yelp.com/biz/",
      "sec-ch-device-memory": "8",
      "sec-ch-ua":
        '"Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"',
      "sec-ch-ua-arch": '"x86"',
      "sec-ch-ua-full-version-list":
        '"Chromium";v="140.0.7339.210", "Not=A?Brand";v="24.0.0.0", "Google Chrome";v="140.0.7339.210"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-model": '""',
      "sec-ch-ua-platform": '"Windows"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
      "x-apollo-operation-name":
        "GetBusinessPartnerData,GetConsumerFooterCopyrightData,GetLocalBusinessJsonLinkedData",
    },
    data: data,
  };

  try {
    const response = await axios.request(config);

    const bizDetails = getBusinessDetails(response.data);

    console.log(bizDetails);
    return bizDetails;
  } catch (error) {
    console.error("Error fetching biz details:", error.message);
    return null;
  }
}

function getBusinessDetails(businessDataArray) {
  if (!Array.isArray(businessDataArray)) {
    console.error("Input must be an array.");
    return {
      name: "N/A",
      address: "N/A",
      phoneNumber: "N/A",
      link: "N/A",
      website: "N/A",
    };
  }

  for (const item of businessDataArray) {
    const business = item?.data?.business;

    if (!business) continue;

    const name = business.name || "N/A";
    const phoneNumber = business.phoneNumber?.formatted || "N/A";

    const address = business.location?.address;
    let fullAddress = "N/A";
    if (address) {
      const addressParts = [
        address.addressLine1,
        address.addressLine2,
        address.addressLine3,
        address.city,
        address.regionCode,
      ].filter(Boolean);

      fullAddress = addressParts.join(", ");
      if (address.postalCode) {
        fullAddress += ` ${address.postalCode}`;
      }
    }
    const link = business.encid
      ? `https://www.yelp.com/biz/${business.encid}`
      : "N/A";

    return { name, address: fullAddress, phoneNumber, link };
  }

  return { name: "N/A", address: "N/A", phoneNumber: "N/A", link: "N/A" };
}

function exportToExcel(data, filePath, sheetName = "Data") {
  if (!Array.isArray(data) || data.length === 0) {
    console.error("Data to export must be a non-empty array.");
    return;
  }
  try {
    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.json_to_sheet(data);
    xlsx.utils.book_append_sheet(workbook, worksheet, sheetName);
    xlsx.writeFile(workbook, filePath);
    console.log(`\nSuccessfully exported data to ${filePath}`);
  } catch (error) {
    console.error(
      `An error occurred during the Excel export: ${error.message}`
    );
  }
}

export async function main(location, desc, fileName) {
  const lastPage = 240; //important change this to 240 ( as its the last page )
  const results = [];
  try {
    for (let index = 0; index < lastPage; index += 10) {
      const html = await fetchYelpHtml(location, desc, index);
      const extractedJson = extractReactRootProps(html);
      const ids = getAllBizIds(extractedJson);
      // fs.appendFileSync("length.json", JSON.stringify(`${ids.length}, `));
      for (const bizId of ids) {
        const data = await getJsonLinkedData(bizId);

        if (data) {
          results.push(data);
        }
        await new Promise((res) => setTimeout(res, delay));
      }
    }

    console.log("-------------------------results---------------------------");
    // console.log(results);
    exportToExcel(results, fileName);
  } catch (e) {
    console.log(e);
  }
}

// main("Los Angeles, California", "Roofers");

// getJsonLinkedData("VcMezuUrJZk1vqW4DmDnLw");
