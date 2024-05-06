const axios = require("axios");
const cheerio = require("cheerio");
const csv = require("csv-writer").createObjectCsvWriter;
const { connectToDatabase } = require("./mongoClient");

const storageBaseUrl = "http://sohoa.baonhandan.vn";
const startYear = 2024;
const endYear = 2024;

const nhanDanDaily = "Nhân dân hằng ngày";
const nhanDanWeekend = "Nhân dân cuối tuần";
const nhanDanMonthly = "Nhân dân hằng tháng";
const thoinay = "Thời nay";

const nhanDanDailyType = 1;
const nhanDanWeekendType = 2;
const nhanDanMonthlyType = 3;
const thoinayType = 4;
const unknownType = 5;

function classifyType(text) {
  if (text.includes(nhanDanDaily)) {
    return nhanDanDailyType;
  }
  if (text.includes(nhanDanWeekend)) {
    return nhanDanWeekendType;
  }
  if (text.includes(nhanDanMonthly)) {
    return nhanDanMonthlyType;
  }
  if (text.includes(thoinay)) {
    return thoinayType;
  }
  return unknownType;
}

async function getUrlPdfLink(url) {
  try {
    const response = await axios.get(storageBaseUrl + url);
    if (response.status === 200) {
      const $temp = cheerio.load(response.data);
      return storageBaseUrl + $temp("input#DEFAULT_URL").attr("value");
    }
  } catch (e) {
    console.error("Error occurred:", e);
    return "";
  }
}

async function crawlPage(url, db, month, year) {
  try {
    const response = await axios.get(url);
    if (response.status === 200) {
      const $ = cheerio.load(response.data);
      const activeDay = $(".is-ngay-item");

      for (const item of activeDay) {
        const info = [];
        const currentDay = $(item).contents().first().text().trim();
        const active = $(item).find(".justify-content-center.mb-5");

        if (currentDay) {
          let pdfLink = "";
          if ($(active).length > 1) {
            for (const link of active.find("a")) {
              const url = $(link).attr("href");
              const numberOfNewspaper = $(link).text().trim();
              pdfLink = await getUrlPdfLink(url);
              info.push({
                paperNo: numberOfNewspaper,
                pdf: pdfLink,
                redirectLink: url.split("/").pop(),
                type: classifyType($(link).attr("title") || ""),
              });
              //   await csvWriter.writeRecords([
              //     {
              //       date: `${currentDay}/${month}/${year}`,
              //       order: numberOfNewspaper,
              //       src: pdfLink,
              //     },
              //   ]);
            }
            // console.log("info: ", info);
          } else if ($(active).length === 1) {
            const url = active.find("a").attr("href");
            const numberOfNewspaper = active.text().trim();
            pdfLink = await getUrlPdfLink(url);
            info.push({
              paperNo: numberOfNewspaper,
              pdf: pdfLink,
              redirectLink: url.split("/").pop(),
              type: classifyType(active.find("a").attr("title") || ""),
            });
            // await csvWriter.writeRecords([
            //   {
            //     date: `${currentDay}/${month}/${year}`,
            //     order: numberOfNewspaper,
            //     src: pdfLink,
            //   },
            // ]);
          }
          await db.insertOne({
            date: `${currentDay}/${month}/${year}`,
            info,
          });
          console.log("success");
        }
      }
    } else {
      console.log("Failed to fetch page:", url);
    }
  } catch (error) {
    console.error("Error occurred:", error);
  }
}

async function crawlPages(startYear, endYear, db) {
  const csvWriter = csv({
    path: "output.csv",
    header: [
      {
        id: "date",
        title: "Date",
      },
      {
        id: "order",
        title: "Order",
      },
      { id: "src", title: "PDF" },
    ],
  });

  for (let year = startYear; year <= endYear; year++) {
    for (let month = 1; month <= 12; month++) {
      const url = `http://sohoa.baonhandan.vn/doc/landing-page-new/ngay.html?Year=${year}&Month=${month}`;
      console.log("Crawling Page: ", url);
      await crawlPage(url, db, month, year);
    }
  }
}

async function main() {
  const db = await connectToDatabase();
  console.log("Connected to the MongoDB");
  const collection = db.collection("pdfs");

  crawlPages(startYear, endYear, collection);
}

main();
