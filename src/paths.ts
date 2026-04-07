import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { camelCase, capitalCase, pascalCase } from "change-case";
import * as R from "ramda";
import type { Operation, Path } from "ringcentral-open-api-parser";

import { capitalizeFirstLetter, patchSrcFile } from "./utils.js";

const generate = (paths: Path[], outputDir: string) => {
  const pathsOutputDir = path.join(outputDir, "paths");
  spawnSync("rm", ["-rf", pathsOutputDir]);
  spawnSync("mkdir", [pathsOutputDir]);

  const generatePathMethod = (
    parameter: string | undefined,
    token: string,
    hasParent: boolean,
    noParentParameter: boolean,
  ): string => {
    if (parameter) {
      return `public path(withParameter = true): string {
    if (withParameter && this.${parameter} !== null) {
        return \`${
          hasParent ? "${this._parent.path()}" : ""
        }/${token}/\${this.${parameter}}\`;
    }
    return ${hasParent ? "`${this._parent.path()}" : "'"}/${token}${
      hasParent ? "`" : "'"
    };
  }`;
    }
    let parentPath = "";
    if (hasParent) {
      if (noParentParameter) {
        parentPath = "${this._parent.path(false)}";
      } else {
        parentPath = "${this._parent.path()}";
      }
    }
    return `public path(): string {
    return ${hasParent ? "`" : "'"}${parentPath}/${token.replace(
      "dotSearch",
      ".search",
    )}${hasParent ? "`" : "'"};
  }`;
  };

  const generateConstructor = (
    parameter: string | undefined,
    defaultValue: string | undefined,
    parentPaths: string[],
  ): string => {
    const result = ["public rc: RingCentralInterface;"];
    if (parentPaths.length > 0) {
      result.push("public _parent: ParentInterface;");
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
            : ""
        }) {`,
      );
      result.push("  this._parent = _parent;");
      result.push("  this.rc = _parent.rc;");
    } else {
      result.push(
        `\n  public constructor(rc: RingCentralInterface${
          parameter
            ? `, ${parameter}: string | null = ${
                defaultValue ? `'${defaultValue}'` : null
              }`
            : ""
        }) {`,
      );
      result.push("  this.rc = rc;");
    }
    if (parameter) {
      result.push(`  this.${parameter} = ${parameter};`);
    }
    result.push("}");

    return result.join("\n  ");
  };

  const generateOperationMethod = (
    operation: Operation,
    parameter: string | undefined,
  ): string => {
    // comments
    const comments = ["/**"];
    comments.push(
      `${(
        operation.description ||
        operation.summary ||
        capitalCase(operation.operationId)
      )
        .split("\n")
        .map((l) => ` * ${l}`)
        .join("\n")}`,
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
    comments.push(" */");
    let result = comments.map((l) => `  ${l}`).join("\n");

    // responseType
    let responseType = "string";
    if (operation.responseSchema) {
      if (
        operation.responseSchema.type === "string" &&
        operation.responseSchema.format === "binary"
      ) {
        responseType = "Uint8Array";
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
            operation.bodyParameters,
          )}`,
        );
      }
    }
    if (operation.queryParameters) {
      methodParams.push(
        `queryParams?: ${capitalizeFirstLetter(operation.queryParameters)}`,
      );
    }
    methodParams.push("restRequestConfig?: RestRequestConfig");

    // requestParams
    const requestParams: string[] = [];
    requestParams.push(
      `this.path(${!operation.withParameter && parameter ? "false" : ""})`,
    );
    if (operation.multipart) {
      requestParams.push("formData");
    } else if (operation.bodyParameters) {
      requestParams.push(operation.bodyParameters);
    } else if (operation.method !== "get") {
      requestParams.push("{}");
    }
    requestParams.push(operation.queryParameters ? "queryParams" : "undefined");
    if (responseType === "Uint8Array") {
      requestParams.push("{...restRequestConfig, responseType: 'arraybuffer'}");
    } else {
      requestParams.push("restRequestConfig");
    }

    // result
    result += `
  public async ${operation.method2}(${methodParams.join(
    ", ",
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
    result += `    const r = await this.rc.${operation.method}<${responseType}>(${requestParams.join(
      ", ",
    )});
    return r.data;
  }`;
    return result;
  };

  for (const item of paths) {
    const lastPath = R.last(item.paths);
    if (!lastPath) {
      continue;
    }
    const itemPaths = item.paths.map((p) => pascalCase(p));
    let code = `class Index {
  ${generateConstructor(
    item.parameter,
    item.defaultParameter,
    R.init(itemPaths),
  )}
  ${generatePathMethod(
    item.parameter,
    lastPath,
    itemPaths.length > 1,
    item.noParentParameter === true,
  )}
${item.operations
  .map((operation) => generateOperationMethod(operation, item.parameter))
  .join("\n\n")}
}
export default Index;
`;

    // imports
    let temp = "RingCentralInterface";
    if (item.paths.length > 1) {
      temp += ", ParentInterface";
    }
    if (item.operations.length > 0) {
      temp += ", RestRequestConfig";
    }
    code = `import { ${temp} } from '${Array(item.paths.length + 1)
      .fill("..")
      .join("/")}/types.js';\n\n${code}`;
    const definitionsUsed = new Set<string>();
    for (const operation of item.operations) {
      if (operation.bodyParameters && !operation.bodyType) {
        definitionsUsed.add(capitalizeFirstLetter(operation.bodyParameters));
      }
      if (operation.queryParameters) {
        definitionsUsed.add(capitalizeFirstLetter(operation.queryParameters));
      }
      if (operation.responseSchema?.$ref) {
        let temp = operation.responseSchema.$ref;
        if (temp.endsWith("[]")) {
          temp = temp.substring(0, temp.length - 2);
        }
        definitionsUsed.add(temp);
      }
    }
    for (const definitionUsed of definitionsUsed) {
      code = `import ${definitionUsed} from "${Array(item.paths.length + 1)
        .fill("..")
        .join("/")}/definitions/${definitionUsed}.js";\n${code}`;
    }
    if (code.indexOf("Utils.") !== -1) {
      code = `import Utils from '${Array(item.paths.length + 1)
        .fill("..")
        .join("/")}/Utils.js';\n${code}`;
    }

    const folder = path.join(pathsOutputDir, ...itemPaths);
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, "index.ts"), code.trim());

    // bridge methods
    if (item.paths.length > 1) {
      patchSrcFile(
        path.join(
          pathsOutputDir,
          ...R.init(item.paths).map((item) => pascalCase(item)),
          "index.ts",
        ),
        [
          `import ${pascalCase(lastPath)} from './${pascalCase(
            lastPath,
          )}/index.js';`,
        ],
        `
  public ${camelCase(lastPath)}(${
    item.parameter
      ? `${item.parameter}: (string | null) = ${
          item.defaultParameter ? `'${item.defaultParameter}'` : "null"
        }`
      : ""
  }): ${pascalCase(lastPath)} {
    return new ${pascalCase(lastPath)}(this${
      item.parameter ? `, ${item.parameter}` : ""
    });
  }
  `.trim(),
      );
    }
  }
};

export default generate;
