import generate from "./index.js";

const specFilePath = process.env.SPEC_FILE_PATH;
const outputFolderPath = process.env.OUTPUT_FOLDER_PATH;

if (!specFilePath || !outputFolderPath) {
  throw new Error("SPEC_FILE_PATH and OUTPUT_FOLDER_PATH must be set");
}

generate(specFilePath, outputFolderPath);
