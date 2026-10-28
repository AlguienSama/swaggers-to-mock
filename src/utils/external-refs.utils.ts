import fs from 'node:fs';
import path from 'node:path';
import jsYaml from 'js-yaml';

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const getFragmentValue = (document: unknown, fragment: string, source: string): unknown => {
  if (!fragment || fragment === '#') {
    return document;
  }

  if (!fragment.startsWith('#/')) {
    throw new Error(`Invalid external reference fragment "${fragment}" in "${source}"`);
  }

  return fragment.slice(2).split('/').reduce<unknown>((current, part) => {
    const key = part.replace(/~1/g, '/').replace(/~0/g, '~');
    if (!isRecord(current) || !(key in current)) {
      throw new Error(`Reference fragment "${fragment}" not found in "${source}"`);
    }
    return current[key];
  }, document);
};

const loadExternalDocument = (filePath: string): unknown => {
  try {
    return jsYaml.load(fs.readFileSync(filePath, 'utf-8'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to load external reference file "${filePath}": ${message}`);
  }
};

export const resolveExternalReferences = (
  value: unknown,
  sourceFile: string,
  resolving: string[] = [],
): unknown => {
  if (Array.isArray(value)) {
    return value.map(item => resolveExternalReferences(item, sourceFile, resolving));
  }

  if (!isRecord(value)) {
    return value;
  }

  if (typeof value.$ref === 'string' && !value.$ref.startsWith('#')) {
    const separatorIndex = value.$ref.indexOf('#');
    const filePart = separatorIndex >= 0 ? value.$ref.slice(0, separatorIndex) : value.$ref;
    const fragment = separatorIndex >= 0 ? value.$ref.slice(separatorIndex) : '#';
    const externalFile = path.resolve(path.dirname(sourceFile), filePart);
    const referenceKey = `${externalFile}#${fragment}`;
    if (resolving.includes(referenceKey)) {
      throw new Error(`Circular external reference detected: ${[...resolving, referenceKey].join(' -> ')}`);
    }

    const externalDocument = loadExternalDocument(externalFile);
    const target = getFragmentValue(externalDocument, fragment, externalFile);
    return resolveExternalReferences(target, externalFile, [...resolving, referenceKey]);
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      resolveExternalReferences(child, sourceFile, resolving),
    ]),
  );
};
