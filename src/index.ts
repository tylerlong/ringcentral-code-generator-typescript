import {parse} from 'ringcentral-open-api-parser';
import yaml from 'js-yaml';
import fs from 'fs';
import {OpenAPIV3} from 'openapi-types';

import generateDefinitions from './definitions';
import generatePaths from './paths';
import generateSamples from './samples';

const generate = (specFilePath: string, outputFolderPath: string) => {
  const doc = yaml.load(
    fs.readFileSync(specFilePath, 'utf8')
  ) as OpenAPIV3.Document;
  const parsed = parse(doc);
  generateDefinitions(parsed.models, outputFolderPath);
  generatePaths(parsed.paths, outputFolderPath);
  generateSamples(parsed.paths, outputFolderPath);
};

export default generate;
