import path from "path";
import { spawnSync } from "child_process";
import { Field, Model } from "ringcentral-open-api-parser/lib/types";
import R from "ramda";
import fs from "fs";

const generate = (models: Model[], outputDir: string) => {
  outputDir = path.join(outputDir, "definitions");
  spawnSync("rm", ["-rf", outputDir]);
  spawnSync("mkdir", [outputDir]);

  const normalizeField = (f: Field): Field => {
    if (f.$ref) {
      f.type = f.$ref;
    } else if (f.type === "integer" || f.type === "number") {
      f.type = "number";
    } else if (f.type === "array") {
      f.type = `${normalizeField(f.items!).type}[]`;
    } else if (f.type === "boolean") {
      f.type = "boolean";
    } else if (f.type === "string") {
      f.type = "string";
      if (f.enum) {
        f.type = `(${
          f.enum
            .map((i: string) => `'${i.toString().replace(/'/g, "\\'")}'`)
            .join(" | ")
        })`;
      }
    } else if (f.type === "byte[]") {
      f.type = "string | Buffer | Blob | NodeJS.ReadableStream";
    } else {
      // do nothing
      // throw new Error(`Unknown type ${f.type}`);
    }
    return f;
  };

  const generateField = (f: Field) => {
    f = normalizeField(f);
    let p = "";
    if (f.name.includes("-") || f.name.includes(":") || f.name.includes(".")) {
      p = `'${f.name}'?: ${f.type};`;
    } else {
      p = `${f.name}?: ${f.type};`;
    }

    p = ` */\n  ${p}`;
    if (f.default) {
      p = ` * Default: ${f.default}\n  ${p}`;
    }
    if (f.example) {
      p = ` * Example: ${f.example}\n  ${p}`;
    }
    if (f.format) {
      p = ` * Format: ${f.format}\n  ${p}`;
    }
    if (f.minimum) {
      p = ` * Minimum: ${f.minimum}\n  ${p}`;
    }
    if (f.maximum) {
      p = ` * Maximum: ${f.maximum}\n  ${p}`;
    }
    if (f.required) {
      p = ` * Required\n  ${p}`;
    }
    if (f.description) {
      p = ` * ${f.description.trim().split("\n").join("\n *  ")}\n  ${p}`;
    }
    p = `/**\n  ${p}`;
    return p;
  };

  models.forEach((model) => {
    let code = `${
      model.description
        ? `/**\n${
          model.description
            .split("\n")
            .map((line) => " * " + line)
            .join("\n")
        }\n*/\n`
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

    fs.writeFileSync(path.join(outputDir, `${model.name}.ts`), code);
  });
};

export default generate;
