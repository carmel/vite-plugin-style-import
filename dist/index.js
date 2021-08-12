"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { newObj[key] = obj[key]; } } } newObj.default = obj; return newObj; } } function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var __require = (x) => {
  if (typeof require !== "undefined")
    return require(x);
  throw new Error('Dynamic require of "' + x + '" is not supported');
};

// src/index.ts
var _pluginutils = require('@rollup/pluginutils');
var _changecase = require('change-case'); var changeCase = _interopRequireWildcard(_changecase);
var _esmodulelexer = require('es-module-lexer');
var _magicstring = require('magic-string'); var _magicstring2 = _interopRequireDefault(_magicstring);
var _path = require('path'); var _path2 = _interopRequireDefault(_path);
var _fs = require('fs'); var _fs2 = _interopRequireDefault(_fs);
var _debug = require('debug');

// src/utils.ts

var _vite = require('vite');

function resolveNodeModules(root, modules, ...dir) {
  return _vite.normalizePath.call(void 0, _path2.default.join(root, modules === "app" ? "src" : "node_modules", ...dir));
}
function resolvePnp(module) {
  try {
    return _vite.normalizePath.call(void 0, __require.resolve(module));
  } catch (error) {
    return "";
  }
}
var isPnp = !!process.versions.pnp;
function isRegExp(value) {
  return Object.prototype.toString.call(value) === "[object RegExp]";
}
function fileExists(f) {
  try {
    _fs2.default.accessSync(f, _fs2.default.constants.W_OK);
    return true;
  } catch (error) {
    return false;
  }
}

// src/index.ts
var debug = _debug.debug.call(void 0, "vite-plugin-style-import");
var ensureFileExts = [".css", ".js", ".scss", ".less", ".styl"];
var asRE = /\s+as\s+\w+,?/g;
var isFn = (value) => value != null && Object.prototype.toString.call(value) === "[object Function]";
var src_default = (options) => {
  const {
    include = ["**/*.vue", "**/*.ts", "**/*.js", "**/*.tsx", "**/*.jsx"],
    exclude = "node_modules/**",
    root = process.cwd(),
    libs = []
  } = options;
  const filter = _pluginutils.createFilter.call(void 0, include, exclude);
  let needSourcemap = false;
  let isBuild = false;
  let external;
  debug("plugin options:", options);
  return {
    name: "vite:style-import",
    enforce: "post",
    configResolved(resolvedConfig) {
      var _a, _b, _c;
      needSourcemap = !!resolvedConfig.build.sourcemap;
      isBuild = resolvedConfig.isProduction || resolvedConfig.command === "build";
      external = (_c = (_b = (_a = resolvedConfig == null ? void 0 : resolvedConfig.build) == null ? void 0 : _a.rollupOptions) == null ? void 0 : _b.external) != null ? _c : void 0;
      debug("plugin config:", resolvedConfig);
    },
    async transform(code, id) {
      if (!code || !filter(id) || !needTransform(code, libs)) {
        return null;
      }
      await _esmodulelexer.init;
      let imports = [];
      try {
        imports = _esmodulelexer.parse.call(void 0, code)[0];
        debug("imports:", imports);
      } catch (e) {
        debug("imports-error:", e);
      }
      if (!imports.length) {
        return null;
      }
      let s;
      const str = () => s || (s = new (0, _magicstring2.default)(code));
      for (let index = 0; index < imports.length; index++) {
        const { n, se, ss } = imports[index];
        if (!n)
          continue;
        const lib = getLib(n, libs, external);
        if (!lib)
          continue;
        const isResolveComponent = isBuild && !!lib.resolveComponent;
        const importStr = code.slice(ss, se);
        let importVariables = transformImportVar(importStr);
        importVariables = filterImportVariables(importVariables, lib.importTest);
        const importCssStrList = transformComponentCss(root, lib, importVariables);
        let compStrList = [];
        let compNameList = [];
        if (isResolveComponent) {
          const { componentStrList, componentNameList } = transformComponent(lib, importVariables);
          compStrList = componentStrList;
          compNameList = componentNameList;
        }
        debug("prepend import css str:", importCssStrList.join(""));
        debug("prepend import component str:", compStrList.join(""));
        const { base = "" } = lib;
        let baseImporter = base ? `
import '${base}'` : "";
        if (str().toString().includes(base)) {
          baseImporter = "";
        }
        const endIndex = se + 1;
        if (isResolveComponent && compNameList.some((item) => importVariables.includes(item))) {
          if (lib.libraryName === "element-plus") {
            str().remove(ss, endIndex);
          } else {
            const importStr2 = str().slice(ss, endIndex);
            const [resultStr, uncssList] = await removeAlreadyName(root, importStr2, lib);
            if (resultStr) {
              str().overwrite(ss, endIndex, resultStr);
            } else {
              str().remove(ss, endIndex);
            }
            if (uncssList.length) {
              compStrList = compStrList.filter((item) => !uncssList.some((imp) => item.startsWith(`import ${imp}`)));
            }
          }
        }
        str().prependRight(endIndex, `${baseImporter}
${compStrList.join("")}${importCssStrList.join("")}`);
      }
      return {
        map: needSourcemap ? str().generateMap({ hires: true }) : null,
        code: str().toString()
      };
    }
  };
};
function filterImportVariables(importVars, reg) {
  if (!reg) {
    return importVars;
  }
  return importVars.filter((item) => reg.test(item));
}
async function removeAlreadyName(root, importStr, lib) {
  let result = importStr;
  const { libraryNameChangeCase = "paramCase", resolveStyle, modules } = lib;
  const exportStr = importStr.replace(asRE, ",").replace("import", "export").replace(asRE, ",");
  await _esmodulelexer.init;
  const importComponents = _esmodulelexer.parse.call(void 0, exportStr)[1];
  const hasCssList = [];
  const unCssList = [];
  importComponents.filter((comp) => {
    const name = getChangeCaseFileName(comp, libraryNameChangeCase);
    const importStr2 = resolveStyle == null ? void 0 : resolveStyle(name);
    if (importStr2) {
      const cssFile = resolveNodeModules(root, modules != null ? modules : "", importStr2);
      if (_fs2.default.existsSync(cssFile)) {
        hasCssList.push(comp);
      } else {
        unCssList.push(comp);
      }
    } else {
      unCssList.push(comp);
    }
  });
  hasCssList.forEach((item) => {
    result = result.replace(new RegExp(`\\s?${item}\\s?,?`), "");
  });
  if (_esmodulelexer.parse.call(void 0, result.replace("import", "export"))[1].length === 0) {
    result = "";
  }
  return [result, unCssList];
}
function transformComponentCss(root, lib, importVariables) {
  const {
    libraryName,
    resolveStyle,
    esModule,
    modules,
    libraryNameChangeCase = "paramCase",
    ensureStyleFile = false
  } = lib;
  if (!isFn(resolveStyle) || !libraryName) {
    return [];
  }
  const set = new Set();
  for (let index = 0; index < importVariables.length; index++) {
    const name = getChangeCaseFileName(importVariables[index], libraryNameChangeCase);
    let importStr = resolveStyle(name);
    if (!importStr) {
      continue;
    }
    let isAdd = true;
    if (isPnp) {
      importStr = resolvePnp(importStr);
      isAdd = !!importStr;
    } else {
      if (esModule) {
        importStr = resolveNodeModules(root, modules != null ? modules : "", importStr);
      }
      if (ensureStyleFile) {
        isAdd = ensureFileExists(root, modules != null ? modules : "", importStr, esModule);
      }
    }
    isAdd && set.add(`import '${importStr}';
`);
  }
  debug("import css sets:", set.toString());
  return Array.from(set);
}
function transformComponent(lib, importVariables) {
  const {
    libraryName,
    resolveComponent,
    libraryNameChangeCase = "paramCase",
    transformComponentImportName
  } = lib;
  if (!isFn(resolveComponent) || !libraryName) {
    return {
      componentStrList: [],
      componentNameList: []
    };
  }
  const componentNameSet = new Set();
  const componentStrSet = new Set();
  for (let index = 0; index < importVariables.length; index++) {
    const libName = importVariables[index];
    const name = getChangeCaseFileName(importVariables[index], libraryNameChangeCase);
    const importStr = resolveComponent(name);
    const importLibName = isFn(transformComponentImportName) && transformComponentImportName(libName) || libName;
    componentStrSet.add(`import ${importLibName} from '${importStr}';
`);
    componentNameSet.add(libName);
  }
  debug("import component set:", componentStrSet.toString());
  return {
    componentStrList: Array.from(componentStrSet),
    componentNameList: Array.from(componentNameSet)
  };
}
function transformImportVar(importStr) {
  if (!importStr) {
    return [];
  }
  const exportStr = importStr.replace("import", "export").replace(asRE, ",");
  let importVariables = [];
  try {
    importVariables = _esmodulelexer.parse.call(void 0, exportStr)[1];
    debug("importVariables:", importVariables);
  } catch (error) {
    debug("transformImportVar:", error);
  }
  return importVariables;
}
function ensureFileExists(root, modules, importStr, esModule = false) {
  const extName = _path2.default.extname(importStr);
  if (!extName) {
    return tryEnsureFile(root, modules, importStr, esModule);
  }
  if (esModule) {
    return fileExists(importStr);
  }
  return true;
}
function tryEnsureFile(root, modules, filePath, esModule = false) {
  const filePathList = ensureFileExts.map((item) => {
    const p = `${filePath}${item}`;
    return esModule ? p : resolveNodeModules(root, modules, p);
  });
  return filePathList.some((item) => fileExists(item));
}
function getLib(libraryName, libs, external) {
  let libList = libs;
  if (external) {
    const isString = typeof external === "string";
    const isRE = isRegExp(external);
    if (isString) {
      libList = libList.filter((item) => item.libraryName !== external);
    } else if (isRE) {
      libList = libList.filter((item) => !external.test(item.libraryName));
    } else if (Array.isArray(external)) {
      libList = libList.filter((item) => {
        return !external.some((val) => {
          if (typeof val === "string") {
            return val === item.libraryName;
          }
          return val.test(item.libraryName);
        });
      });
    }
  }
  return libList.find((item) => item.libraryName === libraryName);
}
function getChangeCaseFileName(importedName, libraryNameChangeCase) {
  try {
    return changeCase[libraryNameChangeCase](importedName);
  } catch (error) {
    return importedName;
  }
}
function needTransform(code, libs) {
  return !libs.every(({ libraryName }) => {
    return !new RegExp(`('${libraryName}')|("${libraryName}")`).test(code);
  });
}




exports.default = src_default; exports.getChangeCaseFileName = getChangeCaseFileName; exports.transformImportVar = transformImportVar;
