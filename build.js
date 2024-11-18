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
const sourcePath = cwd() + "/src";
const targetPath = cwd() + "/dist";
const buildTsConfig = JSON.parse(readFileSync("build.tsconfig.json").toString());

/**
 * @param node String
 * @param source String
 * @param target String
 */
function buildNodeForm(node, source, target) {
  /**
   * @type {string[]}
   */
  const html = [];
  const form = readFileSync(`${source}/form.html`).toString();
  const docs = existsSync(`${source}/docs.html`) ? readFileSync(`${source}/docs.html`).toString() : undefined;

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

  const initTS = readFileSync(`${source}/init.ts`).toString();
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

  mkdirSync(`${target}/`, {
    recursive: true,
  });

  writeFileSync(`${target}/${node}.html`, html.join("\n"));
}

/**
 * @param node String
 * @param source String
 * @param target String
 */
function copyNodeLocales(node, source, target) {
  if (!existsSync(`${source}/locales`)) {
    return;
  }

  readdirSync(`${source}/locales`, {
    recursive: false,
  })
    .filter((language) => {
      return language.match(/^[a-z]{2,2}(?:-[A-Z]{2,2})?\.json$/);
    })
    .forEach((language) => {
      const languageCode = language.match(/^([a-z]{2,2}(?:-[A-Z]{2,2})?)\.json$/i)[1];
      const content = readFileSync(`${source}/locales/${language}`).toString();

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

      mkdirSync(`${target}/locales/${languageCode}`, {
        recursive: true,
      });

      writeFileSync(`${target}/locales/${languageCode}/${node}.json`, json.join("\n"));
    });
}

function buildNodes() {
  readdirSync(`${sourcePath}/nodes`, {
    recursive: false,
  })
    .filter((node) => {
      const path = `${sourcePath}/nodes/${node}`;

      return existsSync(`${path}/form.html`) && existsSync(`${path}/${node}.ts`);
    })
    .forEach((node) => {
      console.info(`Building node ${node}`);

      const source = `${sourcePath}/nodes/${node}`;
      const target = `${targetPath}/nodes/${node}`;

      buildNodeForm(node, source, target);

      copyNodeLocales(node, source, target);
    });
}

function buildPlugins() {
  readdirSync(`${sourcePath}/plugins`, {
    recursive: false,
  })
    .filter((plugin) => {
      const path = `${sourcePath}/plugins/${plugin}`;

      return existsSync(`${path}/${plugin}.ts`);
    })
    .forEach((plugin) => {
      console.info(`Building plugin ${plugin}`);

      // does nothing yet
    });
}

function buildThemes() {
  readdirSync(`${sourcePath}/themes`, {
    recursive: false,
  })
    .filter((theme) => {
      const path = `${sourcePath}/themes/${theme}`;

      return existsSync(`${path}/${theme}.ts`);
    })
    .forEach((theme) => {
      console.info(`Building theme ${theme}`);

      // does nothing yet
    });
}

if (existsSync(`${sourcePath}/plugins`)) {
  buildPlugins();
}

if (existsSync(`${sourcePath}/nodes`)) {
  buildNodes();
}

if (existsSync(`${sourcePath}/themes`)) {
  buildThemes();
}
