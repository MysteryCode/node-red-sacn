const { cwd } = require("process");
const ts = require("typescript");
const {
  cp,
  readdirSync,
  exists,
  existsSync,
  readFileSync,
  writeFile,
  writeFileSync,
  mkdirSync,
  realpathSync,
} = require("node:fs");
const nodesSourceDir = cwd() + "/src/nodes";
const nodesTargetDir = cwd() + "/dist/nodes";
const buildTsConfig = JSON.parse(readFileSync("build.tsconfig.json").toString());

function makeDir(dir) {
  if (!existsSync(dir)) {
    console.log(dir);
    const parentDir = realpathSync(`${dir}../`);
    console.log(parentDir);
    if (!existsSync(parentDir)) {
      makeDir(parentDir);
    }

    mkdirSync(dir);
  }
}

/**
 * @param node String
 * @param sourcePath String
 * @param targetPath String
 */
function buildForm(node, sourcePath, targetPath) {
  /**
   * @type {string[]}
   */
  const html = [];
  const form = readFileSync(`${sourcePath}/form.html`).toString();
  const docs = existsSync(`${sourcePath}/docs.html`) ? readFileSync(`${sourcePath}/docs.html`).toString() : undefined;

  const formLines = form.split("\n");
  html.push(`<script type="text/html" data-template-name="${node}">`);
  formLines.forEach((line) => {
    if (line.length > 0) {
      html.push(`    ${line}`);
    }
  });
  html.push("</script>");

  if (docs) {
    const docsLines = docs.split("\n");
    html.push(`<script type="text/html" data-help-name="${node}">`);
    docsLines.forEach((line) => {
      if (line.length > 0) {
        html.push(`    ${line}`);
      }
    });
    html.push("</script>");
  }

  const initTS = readFileSync(`${sourcePath}/init.ts`).toString();
  let initJS = ts
    .transpileModule(initTS, buildTsConfig)
    .outputText.replace(/export \{(?:[^\}]+)?\};/gim, "")
    .replace(/RED\.nodes\.registerType\("([^\"]+)"/i, `RED.nodes.registerType("${node}"`);

  const initJSLines = initJS.split("\n");
  html.push('<script type="text/javascript">');
  initJSLines.forEach((line) => {
    if (line.length > 0) {
      html.push(`    ${line}`);
    }
  });
  html.push("</script>");

  html.push("");

  mkdirSync(`${targetPath}/`, {
    recursive: true,
  });

  writeFileSync(`${targetPath}/${node}.html`, html.join("\n"));
}

/**
 * @param node String
 * @param sourcePath String
 * @param targetPath String
 */
function copyLocales(node, sourcePath, targetPath) {
  if (!existsSync(`${sourcePath}/locales`)) {
    return;
  }

  readdirSync(`${sourcePath}/locales`, {
    recursive: false,
  })
    .filter((language) => {
      return language.match(/^[a-z]{2,2}(?:-[A-Z]{2,2})?\.json$/);
    })
    .forEach((language) => {
      const languageCode = language.match(/^([a-z]{2,2}(?:-[A-Z]{2,2})?)\.json$/i)[1];
      const content = readFileSync(`${sourcePath}/locales/${language}`).toString();

      /**
       * @type {string[]}
       */
      const json = [];

      const contentLines = content.split("\n");
      const lastElement = json.push("{");
      json.push(`  "${node}": ${contentLines[0]}`);
      contentLines.splice(1).forEach((line) => {
        if (line.length > 0) {
          json.push(`  ${line}`);
        }
      });
      json.push("}");

      mkdirSync(`${targetPath}/locales/${languageCode}`, {
        recursive: true,
      });

      writeFileSync(`${targetPath}/locales/${languageCode}/${node}.json`, json.join("\n"));
    });
}

readdirSync(nodesSourceDir, {
  recursive: false,
})
  .filter((node) => {
    const path = `${nodesSourceDir}/${node}`;

    return existsSync(`${path}/form.html`) && existsSync(`${path}/${node}.ts`);
  })
  .forEach((node) => {
    const sourcePath = `${nodesSourceDir}/${node}`;
    const targetPath = `${nodesTargetDir}/${node}`;

    buildForm(node, sourcePath, targetPath);

    copyLocales(node, sourcePath, targetPath);
  });
