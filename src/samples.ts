import R from "ramda";
import { Path } from "ringcentral-open-api-parser/lib/types";
import { camelCase } from "change-case";
import fs from "fs";
import path from "path";

import { capitalizeFirstLetter } from "./utils";

const generate = (paths: Path[], outputDir: string) => {
  const markdown = ["# RingCentral TypeScript Code Samples"];

  paths = R.sortBy(R.path(["operations", 0, "endpoint"]) as any, paths);

  const buildPath = (s: string): string => {
    const tokens = s.split("/").filter((t) => t.length > 0);
    let result = "";
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token.startsWith("{")) {
        result += `(${token.slice(1, token.length - 1)})`;
      } else {
        result += `.${camelCase(token)}`;
        if (i >= tokens.length - 1 || !tokens[i + 1].startsWith("{")) {
          result += "()";
        }
      }
    }
    return result;
  };

  for (const path of paths.filter((item) => item.operations.length > 0)) {
    for (const operation of path.operations) {
      const parameters = [];
      if (operation.bodyParameters) {
        parameters.push(operation.bodyParameters);
      }
      if (operation.queryParameters) {
        parameters.push(operation.queryParameters);
      }
      markdown.push(`\n## ${operation.operationId}`);
      markdown.push(operation.summary ?? "");

      markdown.push("\nName|Value");
      markdown.push("-|-");
      markdown.push(`HTTP Method|\`${operation.method.toUpperCase()}\``);
      markdown.push(`Endpoint|\`${operation.endpoint}\``);
      markdown.push(`Rate Limit Group|\`${operation.rateLimitGroup}\``);
      markdown.push(`App Permission|\`${operation.appPermission ?? "N/A"}\``);
      markdown.push(`User Permission|\`${operation.userPermission ?? "N/A"}\``);

      markdown.push("\n```ts");
      markdown.push(
        "const rc = new RingCentral({clientId, clientSecret, server});",
      );
      markdown.push("await rc.authorize({jwt});");
      markdown.push(
        `var result = await rc${
          buildPath(operation.endpoint)
        }.${operation.method2}(${parameters.join(", ")});`,
      );
      markdown.push("await rc.revoke();");
      markdown.push("```\n");

      if (operation.endpoint.indexOf("{apiVersion}") !== -1) {
        markdown.push(
          "- Parameter `apiVersion` is optional with default value `v1.0`",
        );
      }
      if (operation.endpoint.indexOf("/scim/{version}") !== -1) {
        markdown.push(
          "- Parameter `version` is optional with default value `v2`",
        );
      }
      if (operation.endpoint.indexOf("/account/{accountId}") !== -1) {
        markdown.push(
          "- Parameter `accountId` is optional with default value `~`",
        );
      }
      if (operation.endpoint.indexOf("/extension/{extensionId}") !== -1) {
        markdown.push(
          "- Parameter `extensionId` is optional with default value `~`",
        );
      }

      for (const parameter of parameters) {
        markdown.push(
          `- \`${parameter}\` is of type [${
            capitalizeFirstLetter(
              parameter,
            )
          }](./definitions/${capitalizeFirstLetter(parameter)}.ts)`,
        );
      }

      if (operation.responseSchema?.$ref) {
        let className = operation.responseSchema.$ref;
        let isArray = false;
        if (className.endsWith("[]")) {
          isArray = true;
          className = className.slice(0, -2);
        }
        markdown.push(
          `- \`result\` is of type [${className}](./definitions/${className}.ts)`,
        );
      } else if (!operation.responseSchema) {
        markdown.push("- `result` is an empty string");
      } else if (operation.responseSchema.format === "binary") {
        markdown.push("- `result` is of type `byte[]`");
        markdown.push(`\n### ❗❗❗ Code sample above may not work
\nPlease refer to [Binary content downloading](/README.md#Binary-content-downloading).`);
      } else if (operation.responseSchema.type === "string") {
        markdown.push("- `result` is a string");
      } else {
        console.log(operation);
      }

      markdown.push(
        `\n[Try it out](https://developer.ringcentral.com/api-reference#${
          operation.tags![0].replace(
            / /g,
            "-",
          )
        }-${operation.operationId}) in API Explorer.`,
      );
    }
  }

  fs.writeFileSync(path.join(outputDir, "samples.md"), markdown.join("\n"));
};

export default generate;
