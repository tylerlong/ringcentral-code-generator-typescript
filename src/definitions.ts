import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import * as R from "ramda";
import type { Field, Model } from "ringcentral-open-api-parser";

const generate = (models: Model[], outputDir: string) => {
  const definitionsOutputDir = path.join(outputDir, "definitions");
  spawnSync("rm", ["-rf", definitionsOutputDir]);
  spawnSync("mkdir", [definitionsOutputDir]);

  const normalizeField = (f: Field): Field => {
    if (f.$ref) {
      f.type = f.$ref;
    } else if (f.type === "integer" || f.type === "number") {
      f.type = "number";
    } else if (f.type === "array") {
      if (!f.items) {
        throw new Error("Array field missing items definition");
      }
      f.type = `${normalizeField(f.items).type}[]`;
    } else if (f.type === "boolean") {
      f.type = "boolean";
    } else if (f.type === "string") {
      f.type = "string";
      if (f.enum) {
        f.type = `(${f.enum
          .map((i: string) => `'${i.toString().replace(/'/g, "\\'")}'`)
          .join(" | ")})`;
      }
    } else if (f.type === "byte[]") {
      f.type = "string | Uint8Array | Blob | AsyncIterable<Uint8Array>";
    } else {
      // do nothing
      // throw new Error(`Unknown type ${f.type}`);
    }
    return f;
  };

  const generateField = (f: Field) => {
    const normalizedField = normalizeField(f);
    let p = "";
    if (
      normalizedField.name.includes("-") ||
      normalizedField.name.includes(":") ||
      normalizedField.name.includes(".")
    ) {
      p = `'${normalizedField.name}'?: ${normalizedField.type};`;
    } else {
      p = `${normalizedField.name}?: ${normalizedField.type};`;
    }

    p = ` */\n  ${p}`;
    if (normalizedField.default) {
      p = ` * Default: ${normalizedField.default}\n  ${p}`;
    }
    if (normalizedField.example) {
      p = ` * Example: ${normalizedField.example}\n  ${p}`;
    }
    if (normalizedField.format) {
      p = ` * Format: ${normalizedField.format}\n  ${p}`;
    }
    if (normalizedField.minimum) {
      p = ` * Minimum: ${normalizedField.minimum}\n  ${p}`;
    }
    if (normalizedField.maximum) {
      p = ` * Maximum: ${normalizedField.maximum}\n  ${p}`;
    }
    if (normalizedField.required) {
      p = ` * Required\n  ${p}`;
    }
    if (normalizedField.description) {
      p = ` * ${normalizedField.description.trim().split("\n").join("\n *  ")}\n  ${p}`;
    }
    p = `/**\n  ${p}`;
    return p;
  };

  for (const model of models) {
    let code = `${
      model.description
        ? `/**\n${model.description
            .split("\n")
            .map((line) => ` * ${line}`)
            .join("\n")}\n*/\n`
        : ""
    }interface ${model.name} {
    ${model.fields.map((f) => generateField(f)).join("\n\n  ")}
}

export default ${model.name};
`;

    // imports
    const match = code.match(/(?<=^ {2}\S+?: )[A-Z][A-Za-z0-9]+?\b/gm);
    if (match !== null) {
      const imports = R.without([model.name], R.uniq(match))
        .map((name) => `import ${name} from "./${name}.js";`)
        .join("\n");
      code = `${imports}\n\n${code}`;
    }

    fs.writeFileSync(path.join(definitionsOutputDir, `${model.name}.ts`), code);
  }
};

export default generate;
