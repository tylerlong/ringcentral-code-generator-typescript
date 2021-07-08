import {parse} from 'ringcentral-open-api-parser';
import yaml from 'js-yaml';
import fs from 'fs';
import {OpenAPIV3} from 'openapi-types';

const generate = (specFilePath: string, outputFolderPath: string) => {
  const doc = yaml.load(
    fs.readFileSync(specFilePath, 'utf8')
  ) as OpenAPIV3.Document;
  const parsed = parse(doc);
  console.log(JSON.stringify(parsed, null, 2));
};

export default generate;
