const { cwd } = require("node:process");
const ts = require("typescript");
const {
  readdirSync,
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  realpathSync,
  copyFileSync,
} = require("node:fs");

// directory containing the sources for nodes; defaults to `src/nodes` within the current working directory
const nodesSourceDir = cwd() + "/src/nodes";
// directory the generated files should be saved to; defaults to `dist/nodes` within the current working directory
const nodesTargetDir = cwd() + "/dist/nodes";
// path to the typescript project configuration for building the nodes
const buildTsConfig = JSON.parse(readFileSync("build.tsconfig.json").toString());

/**
 * Creates a directory if it does not exist
 * @param {string} dir directory path to create
 */
function makeDir(dir) {
  // bypass everything in case the directory already exists
  if (!existsSync(dir)) {
    const parentDir = realpathSync(`${dir}../`);

    // check whether parent directory exists and create it recursively if not
    if (!existsSync(parentDir)) {
      makeDir(parentDir);
    }

    // finally create the directory
    mkdirSync(dir);
  }
}

/**
 * Builds the form for editing a node using the Node-RED Editor.
 *
 * @param {string} node name of the node the form belongs to
 * @param {string} sourcePath path of the directory containing the node's source files
 * @param {string} targetPath path of the directory the node's generated files should be saved to
 */
function buildForm(node, sourcePath, targetPath) {
  /**
   * @type {string[]}
   */
  const html = [];
  const form = readFileSync(`${sourcePath}/form.html`).toString();
  const docs = existsSync(`${sourcePath}/docs.html`) ? readFileSync(`${sourcePath}/docs.html`).toString() : undefined;

  // parse `form.html` and wrap it to the corresponding script-tag
  const formLines = form.split("\n");
  html.push(`<script type="text/html" data-template-name="${node}">`);
  formLines.forEach((line) => {
    if (line.length > 0) {
      html.push(`    ${line}`);
    }
  });
  html.push("</script>");

  // parse `docs.html` and wrap it to the corresponding script-tag
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

  // read and transpile the node's TypeScript
  const initTS = readFileSync(`${sourcePath}/init.ts`).toString();
  let initJS = ts
    .transpileModule(initTS, buildTsConfig)
    .outputText.replace(/export \{(?:[^\}]+)?\};/gim, "")
    .replace(/RED\.nodes\.registerType\("([^\"]+)"/i, `RED.nodes.registerType("${node}"`);

  // inject the node's init logic into the node's HTML
  const initJSLines = initJS.split("\n");
  html.push('<script type="text/javascript">');
  initJSLines.forEach((line) => {
    if (line.length > 0) {
      html.push(`    ${line}`);
    }
  });
  html.push("</script>");

  html.push("");

  // create node's target directory
  mkdirSync(`${targetPath}/`, {
    recursive: true,
  });

  // save the node's editor formular
  writeFileSync(`${targetPath}/${node}.html`, html.join("\n"));
}

/**
 * Copys the locale files of a node.
 *
 * @param {string} node name of the node the form belongs to
 * @param {string} sourcePath path of the directory containing the node's source files
 * @param {string} targetPath path of the directory the node's generated files should be saved to
 */
function copyLocales(node, sourcePath, targetPath) {
  // skip in case directory `locales` does not exist within the nodes directory
  if (!existsSync(`${sourcePath}/locales`)) {
    return;
  }

  readdirSync(`${sourcePath}/locales`, {
    recursive: false,
  })
    .filter((language) => {
      // filter for files named as valid language codes
      return language.match(/^[a-z]{2,2}(?:-[A-Z]{2,2})?\.json$/);
    })
    .forEach((language) => {
      // read the language code and the JSON
      const languageCode = language.match(/^([a-z]{2,2}(?:-[A-Z]{2,2})?)\.json$/i)[1];
      const content = readFileSync(`${sourcePath}/locales/${language}`).toString();

      /**
       * @type {string[]}
       */
      const json = ["{"];

      // wrap locales content within a tag names like the node
      const contentLines = content.split("\n");
      json.push(`  "${node}": ${contentLines[0]}`);
      contentLines.splice(1).forEach((line) => {
        if (line.length > 0) {
          json.push(`  ${line}`);
        }
      });
      json.push("}");

      // create node locales target directory
      mkdirSync(`${targetPath}/locales/${languageCode}`, {
        recursive: true,
      });

      // save the node's locales
      writeFileSync(`${targetPath}/locales/${languageCode}/${node}.json`, json.join("\n"));
    });
}

/**
 * Copy icons of a node.
 *
 @param {string} node name of the node the form belongs to
 @param {string} sourcePath path of the directory containing the node's source files
 @param {string} targetPath path of the directory the node's generated files should be saved to
 */
function copyIcons(node, sourcePath, targetPath) {
  // skip in case directory `icons` does not exist within the nodes directory
  if (!existsSync(`${sourcePath}/icons`)) {
    return;
  }

  // create node icons target directory
  mkdirSync(`${targetPath}/icons`, {
    recursive: true,
  });

  // copy the node's icons
  readdirSync(`${sourcePath}/icons`, {
    recursive: false,
  }).forEach((icon) => {
    copyFileSync(`${sourcePath}/icons/${icon}`, `${targetPath}/icons/${icon}`);
  });
}

/*
 * Iterate over every directory
 */
readdirSync(nodesSourceDir, {
  recursive: false,
})
  .filter((node) => {
    const path = `${nodesSourceDir}/${node}`;

    // filter for directories containing at least a `form.html` and the nodes logic script `node.ts`
    return existsSync(`${path}/form.html`) && existsSync(`${path}/${node}.ts`);
  })
  .forEach((node) => {
    const sourcePath = `${nodesSourceDir}/${node}`;
    const targetPath = `${nodesTargetDir}/${node}`;

    // build the nodes' form for Node-RED Editor
    buildForm(node, sourcePath, targetPath);

    // copy/transfer optional assets
    copyLocales(node, sourcePath, targetPath);
    copyIcons(node, sourcePath, targetPath);
  });
