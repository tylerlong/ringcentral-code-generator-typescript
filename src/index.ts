import { prepareSpec } from "ringcentral-open-api-parser";

import generateDefinitions from "./definitions.js";
import generatePaths from "./paths.js";
import generateSamples from "./samples.js";

const generate = (specFilePath: string, outputFolderPath: string) => {
  const parsed = prepareSpec(specFilePath);
  generateDefinitions(parsed.models, outputFolderPath);
  generatePaths(parsed.paths, outputFolderPath);
  generateSamples(parsed.paths, outputFolderPath);
};

export default generate;
