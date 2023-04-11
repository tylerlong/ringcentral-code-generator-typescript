import {prepareSpec} from 'ringcentral-open-api-parser';

import generateDefinitions from './definitions';
import generatePaths from './paths';
import generateSamples from './samples';

const generate = (specFilePath: string, outputFolderPath: string) => {
  const parsed = prepareSpec(specFilePath);
  generateDefinitions(parsed.models, outputFolderPath);
  generatePaths(parsed.paths, outputFolderPath);
  generateSamples(parsed.paths, outputFolderPath);
};

export default generate;
