const axios = require("axios");
const fs = require("fs");
const { execSync } = require("child_process");
const { connectToDatabase } = require("./mongoClient");

const OUTPUT_FOLDER = "output";
const INPUT_FOLDER = "input";

async function makeFolder(folderName) {
  try {
    if (!fs.existsSync(folderName)) {
      fs.mkdirSync(folderName);
    }
  } catch (err) {
    console.error(err);
  }
}

async function downloadPDF(url, destination) {
  const response = await axios({
    method: "GET",
    url: url,
    responseType: "stream",
  });

  const writer = fs.createWriteStream(destination);

  response.data.pipe(writer);

  await new Promise((resolve, reject) => {
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
}

async function convertPDFToImage(pdfPath, pageNumber, outputPath) {
  const dpi = 150;
  const command = `pdftoppm -jpeg -singlefile -cropbox -r ${dpi} -f ${pageNumber} -l ${pageNumber} "${pdfPath}" "${outputPath}"`;
  await execSync(command);
}

async function processConvertPDFToImage(item) {
  const destPath = item.date.split("/").join("-");
  const pageNumber = 1;

  await makeFolder(INPUT_FOLDER);
  await makeFolder(OUTPUT_FOLDER);
  const pdfDestination = `${INPUT_FOLDER}/${destPath}.pdf`;
  const outputImagePath = `${OUTPUT_FOLDER}/${destPath}`;

  try {
    await downloadPDF(item.info.pdf, pdfDestination);
    await convertPDFToImage(pdfDestination, pageNumber, outputImagePath);
    console.log("Images saved to:", outputImagePath);
  } catch (error) {
    console.error("Error:", error);
  }
}

async function main() {
  try {
    const db = await connectToDatabase();
    console.log("Connected to MongoDB");
    const collection = db.collection("test");
    const startDate = "1/1/2000";
    const endDate = "1/31/2000";

    const result = await collection
      .aggregate([
        {
          $addFields: {
            convertedDate: {
              $dateFromString: {
                dateString: "$date",
                format: "%d/%m/%Y",
              },
            },
          },
        },
        {
          $match: {
            convertedDate: {
              $gte: new Date(startDate),
              $lte: new Date(endDate),
            },
          },
        },
        {
          $unwind: "$info",
        },
        {
          $match: {
            "info.type": 1,
          },
        },
        {
          $group: {
            _id: "$_id",
            date: { $first: "$date" },
            info: { $first: "$info" },
          },
        },
      ])
      .toArray();

    console.log("Processing PDFs...");
    const start = Date.now();
    await Promise.all(result.map(processConvertPDFToImage));
    console.log("All PDFs processed successfully.");
    console.log("Time taken:", Date.now() - start, "ms");
  } catch (error) {
    console.error("An error occurred while processing PDFs:", error);
  }
}

main();
