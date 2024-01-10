import fs from 'fs';
import path from 'path';
import {spawnSync} from 'child_process';
import {Operation, Path} from 'ringcentral-open-api-parser/lib/types';
import {pascalCase, capitalCase, camelCase} from 'change-case';
import R from 'ramda';

import {capitalizeFirstLetter, patchSrcFile} from './utils';

const generate = (paths: Path[], outputDir: string) => {
  outputDir = path.join(outputDir, 'paths');
  spawnSync('rm', ['-rf', outputDir]);
  spawnSync('mkdir', [outputDir]);

  const generatePathMethod = (
    parameter: string | undefined,
    token: string,
    hasParent: boolean,
    noParentParameter: boolean
  ): string => {
    if (parameter) {
      return `public path(withParameter = true): string {
    if (withParameter && this.${parameter} !== null) {
        return \`${
          hasParent ? '${this._parent.path()}' : ''
        }/${token}/\${this.${parameter}}\`;
    }
    return ${hasParent ? '`${this._parent.path()}' : "'"}/${token}${
      hasParent ? '`' : "'"
    };
  }`;
    } else {
      let parentPath = '';
      if (hasParent) {
        if (noParentParameter) {
          parentPath = '${this._parent.path(false)}';
        } else {
          parentPath = '${this._parent.path()}';
        }
      }
      return `public path(): string {
    return ${hasParent ? '`' : "'"}${parentPath}/${token.replace(
      'dotSearch',
      '.search'
    )}${hasParent ? '`' : "'"};
  }`;
    }
  };

  const generateConstructor = (
    parameter: string | undefined,
    defaultValue: string | undefined,
    parentPaths: string[]
  ): string => {
    const result = ['public rc: RingCentralInterface;'];
    if (parentPaths.length > 0) {
      result.push('public _parent: ParentInterface;');
    }
    if (parameter) {
      result.push(`public ${parameter}: string | null;`);
    }
    if (parentPaths.length > 0) {
      result.push(
        `\n  public constructor(_parent: ParentInterface${
          parameter
            ? `, ${parameter}: string | null = ${
                defaultValue ? `'${defaultValue}'` : null
              }`
            : ''
        }) {`
      );
      result.push('  this._parent = _parent;');
      result.push('  this.rc = _parent.rc;');
    } else {
      result.push(
        `\n  public constructor(rc: RingCentralInterface${
          parameter
            ? `, ${parameter}: string | null = ${
                defaultValue ? `'${defaultValue}'` : null
              }`
            : ''
        }) {`
      );
      result.push('  this.rc = rc;');
    }
    if (parameter) {
      result.push(`  this.${parameter} = ${parameter};`);
    }
    result.push('}');

    return result.join('\n  ');
  };

  const generateOperationMethod = (
    operation: Operation,
    parameter: string | undefined
  ): string => {
    // comments
    const comments = ['/**'];
    comments.push(
      `${(
        operation.description ||
        operation.summary ||
        capitalCase(operation.operationId)
      )
        .split('\n')
        .map(l => ` * ${l}`)
        .join('\n')}`
    );
    comments.push(` * HTTP Method: ${operation.method}`);
    comments.push(` * Endpoint: ${operation.endpoint}`);
    if (operation.rateLimitGroup) {
      comments.push(` * Rate Limit Group: ${operation.rateLimitGroup}`);
    }
    if (operation.appPermission) {
      comments.push(` * App Permission: ${operation.appPermission}`);
    }
    if (operation.userPermission) {
      comments.push(` * User Permission: ${operation.userPermission}`);
    }
    comments.push(' */');
    let result = comments.map(l => `  ${l}`).join('\n');

    // responseType
    let responseType = 'string';
    if (operation.responseSchema) {
      if (
        operation.responseSchema.type === 'string' &&
        operation.responseSchema.format === 'binary'
      ) {
        responseType = 'Buffer';
      } else if (operation.responseSchema.$ref) {
        responseType = operation.responseSchema.$ref;
      }
    }

    // methodParams
    const methodParams: string[] = [];
    if (operation.bodyParameters) {
      if (operation.bodyType) {
        methodParams.push(`${operation.bodyParameters}: ${operation.bodyType}`);
      } else {
        methodParams.push(
          `${operation.bodyParameters}: ${capitalizeFirstLetter(
            operation.bodyParameters
          )}`
        );
      }
    }
    if (operation.queryParameters) {
      methodParams.push(
        `queryParams?: ${capitalizeFirstLetter(operation.queryParameters)}`
      );
    }
    methodParams.push('restRequestConfig?: RestRequestConfig');

    // requestParams
    const requestParams: string[] = [];
    requestParams.push(
      `this.path(${!operation.withParameter && parameter ? 'false' : ''})`
    );
    if (operation.multipart) {
      requestParams.push('formData');
    } else if (operation.bodyParameters) {
      requestParams.push(operation.bodyParameters);
    } else if (operation.method !== 'get') {
      requestParams.push('undefined');
    }
    requestParams.push(operation.queryParameters ? 'queryParams' : 'undefined');
    if (responseType === 'Buffer') {
      requestParams.push("{...restRequestConfig, responseType: 'arraybuffer'}");
    } else {
      requestParams.push('restRequestConfig');
    }

    // result
    result += `
  public async ${operation.method2}(${methodParams.join(
    ', '
  )}): Promise<${responseType}> {\n`;
    if (operation.withParameter) {
      result += `    if (this.${parameter} === null)
    {
        throw new Error('${parameter} must be specified.');
    }
`;
    }
    if (operation.multipart) {
      result += `const formData = await Utils.getFormData(${operation.bodyParameters});\n`;
    }
    result += `    const r = await this.rc.${
      operation.method
    }<${responseType}>(${requestParams.join(', ')});
    return r.data;
  }`;
    return result;
  };

  for (const item of paths) {
    const itemPaths = item.paths.map(p => pascalCase(p));
    let code = `class Index {
  ${generateConstructor(
    item.parameter,
    item.defaultParameter,
    R.init(itemPaths)
  )}
  ${generatePathMethod(
    item.parameter,
    R.last(item.paths)!,
    itemPaths.length > 1,
    item.noParentParameter === true
  )}
${item.operations
  .map(operation => generateOperationMethod(operation, item.parameter))
  .join('\n\n')}
}
export default Index;
`;

    // imports
    let temp = 'RingCentralInterface';
    if (item.paths.length > 1) {
      temp += ', ParentInterface';
    }
    if (item.operations.length > 0) {
      temp += ', RestRequestConfig';
    }
    code = `import { ${temp} } from '${Array(item.paths.length + 1)
      .fill('..')
      .join('/')}/types';\n\n${code}`;
    const definitionsUsed = new Set();
    for (const operation of item.operations) {
      if (operation.bodyParameters && !operation.bodyType) {
        definitionsUsed.add(capitalizeFirstLetter(operation.bodyParameters));
      }
      if (operation.queryParameters) {
        definitionsUsed.add(capitalizeFirstLetter(operation.queryParameters));
      }
      if (operation.responseSchema?.$ref) {
        definitionsUsed.add(operation.responseSchema.$ref);
      }
    }
    for (const definitionUsed of definitionsUsed) {
      code = `import ${definitionUsed} from '${Array(item.paths.length + 1)
        .fill('..')
        .join('/')}/definitions/${definitionUsed}';\n${code}`;
    }
    if (code.indexOf('Utils.') !== -1) {
      code = `import Utils from '${Array(item.paths.length + 1)
        .fill('..')
        .join('/')}/Utils';\n${code}`;
    }

    const folder = path.join(outputDir, ...itemPaths);
    fs.mkdirSync(folder, {recursive: true});
    fs.writeFileSync(path.join(folder, 'index.ts'), code.trim());

    // bridge methods
    if (item.paths.length > 1) {
      patchSrcFile(
        path.join(
          outputDir,
          ...R.init(item.paths).map(item => pascalCase(item)),
          'index.ts'
        ),
        [
          `import ${pascalCase(R.last(item.paths)!)} from './${pascalCase(
            R.last(item.paths)!
          )}';`,
        ],
        `
  public ${camelCase(R.last(item.paths)!)}(${
    item.parameter
      ? `${item.parameter}: (string | null) = ${
          item.defaultParameter ? `'${item.defaultParameter}'` : 'null'
        }`
      : ''
  }): ${pascalCase(R.last(item.paths)!)} {
    return new ${pascalCase(R.last(item.paths)!)}(this${
      item.parameter ? `, ${item.parameter}` : ''
    });
  }
  `.trim()
      );
    }
  }
};

export default generate;
