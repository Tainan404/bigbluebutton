/* eslint-disable import/no-extraneous-dependencies */
const fs = require('node:fs');
const acorn = require('webpack/node_modules/acorn');
const eslintScope = require('eslint-scope');
const { TraceMap, originalPositionFor } = require('@jridgewell/trace-mapping');

const childNodes = (node) => Object.entries(node)
  .filter(([key]) => !['loc', 'range', 'start', 'end'].includes(key))
  .flatMap(([, value]) => (Array.isArray(value) ? value : [value]))
  .filter((value) => value && typeof value.type === 'string');

const walk = (node, visit) => {
  visit(node);
  childNodes(node).forEach((child) => walk(child, visit));
};

const referencesByStart = (scopeManager) => {
  const references = new Map();
  scopeManager.scopes.forEach((scope) => {
    [...scope.references, ...scope.through].forEach((reference) => {
      references.set(reference.identifier.start, reference);
    });
  });
  return references;
};

const isOuterReference = (reference, property) => {
  if (!reference || !reference.resolved) return false;
  return reference.resolved.defs.length === 0
    || reference.resolved.defs.some((definition) => (
      definition.name.start < property.start || definition.name.end > property.end
    ));
};

const traceLocation = (file, location) => {
  const mapFile = `${file}.map`;
  if (!fs.existsSync(mapFile)) return null;
  const map = new TraceMap(JSON.parse(fs.readFileSync(mapFile, 'utf8')));
  return originalPositionFor(map, { line: location.line, column: location.column });
};

const inspectBundle = (file) => {
  const source = fs.readFileSync(file, 'utf8');
  const parserOptions = {
    ecmaVersion: 'latest', sourceType: 'script', locations: true, ranges: true,
  };
  const scopeAst = acorn.parse(source, parserOptions);
  const scopeManager = eslintScope.analyze(scopeAst, {
    ecmaVersion: 2022, sourceType: 'script', optimistic: true, ignoreEval: true,
  });
  const references = referencesByStart(scopeManager);
  const ast = acorn.parse(source, { ...parserOptions, preserveParens: true });
  const findings = [];

  walk(ast, (property) => {
    if (property.type !== 'PropertyDefinition' || !property.value) return;
    const candidates = [];
    walk(property.value, (node) => {
      if (node.type !== 'NewExpression') return;
      node.arguments.forEach((argument) => {
        if (argument.type === 'ParenthesizedExpression') candidates.push(argument);
      });
    });
    candidates.forEach((candidate) => {
      const priorOuterReferences = [];
      walk(property.value, (node) => {
        if (node.type !== 'Identifier' || node.start >= candidate.start) return;
        const reference = references.get(node.start);
        if (isOuterReference(reference, property)) priorOuterReferences.push(node.name);
      });
      if (priorOuterReferences.length === 0) return;
      findings.push({
        file,
        generated: candidate.loc.start,
        original: traceLocation(file, candidate.loc.start),
        outerBindings: [...new Set(priorOuterReferences)],
        expressionType: candidate.expression.type,
        excerpt: source.slice(
          Math.max(property.start, candidate.start - 80),
          Math.min(property.end, candidate.end + 120),
        ),
      });
    });
  });
  return findings;
};

module.exports = { inspectBundle };
/* eslint-disable import/no-extraneous-dependencies */
