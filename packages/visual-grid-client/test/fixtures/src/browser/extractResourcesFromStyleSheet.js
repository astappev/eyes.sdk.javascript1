'use strict';
const getUrlFromCssText = require('./getUrlFromCssText');
const uniq = require('./uniq');

function makeExtractResourcesFromStyleSheet({styleSheetCache}) {
  return function extractResourcesFromStyleSheet(styleSheet, doc) {
    const win = doc.defaultView || (doc.ownerDocument && doc.ownerDocument.defaultView) || window;
    return uniq(
      Array.from(styleSheet.cssRules || []).reduce((acc, rule) => {
        if (rule instanceof win.CSSImportRule) {
          styleSheetCache[rule.styleSheet.href] = rule.styleSheet;
          return acc.concat(rule.href);
        } else if (rule instanceof win.CSSFontFaceRule) {
          return acc.concat(getUrlFromCssText(rule.cssText));
        } else if (
          (win.CSSSupportsRule && rule instanceof win.CSSSupportsRule) ||
          rule instanceof win.CSSMediaRule
        ) {
          return acc.concat(extractResourcesFromStyleSheet(rule, doc));
        } else if (rule instanceof win.CSSStyleRule) {
          for (let i = 0, ii = rule.style.length; i < ii; i++) {
            const urls = getUrlFromCssText(rule.style.getPropertyValue(rule.style[i]));
            urls.length && (acc = acc.concat(urls));
          }
        }
        return acc;
      }, []),
    );
  };
}

module.exports = makeExtractResourcesFromStyleSheet;