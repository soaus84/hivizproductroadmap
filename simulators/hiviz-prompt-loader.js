/**
 * hiviz-prompt-loader.js
 * Fetches canonical system prompts from specs/features/ at runtime.
 */

const SPEC_BASE = '/specs/features/';

/**
 * Extracts the text inside the first ``` code fence after a named section header.
 * Uses plain string search — no regex — for reliability.
 */
function extractSection(markdown, sectionName) {
  const header = '### ' + sectionName;
  const headerPos = markdown.indexOf(header);

  if (headerPos === -1) {
    console.warn('[prompt-loader] Section not found: ' + sectionName);
    console.warn('[prompt-loader] Available sections:', getSectionNames(markdown));
    return null;
  }

  const afterHeader = markdown.slice(headerPos + header.length);

  // Find the opening ``` — may be preceded by one or two newlines
  // Search for just "```\n" and find the first occurrence after the header
  const fenceOpen = afterHeader.indexOf('```\n');

  if (fenceOpen === -1) {
    console.warn('[prompt-loader] No opening code fence after: ' + sectionName);
    return null;
  }

  // Content starts immediately after the ``` and newline
  const contentStart = fenceOpen + 4; // length of '```\n'
  const afterFenceOpen = afterHeader.slice(contentStart);

  // Find the closing ``` on its own line
  const fenceClose = afterFenceOpen.indexOf('\n```');

  if (fenceClose === -1) {
    console.warn('[prompt-loader] No closing code fence in section: ' + sectionName);
    return null;
  }

  return afterFenceOpen.slice(0, fenceClose).trim();
}

function getSectionNames(markdown) {
  const names = [];
  for (const line of markdown.split('\n')) {
    if (line.startsWith('### CANONICAL-')) {
      names.push(line.replace('### ', '').trim());
    }
  }
  return names;
}

async function loadFeatureSpec(featureName) {
  const url = SPEC_BASE + featureName + '.md';

  let response;
  try {
    response = await fetch(url);
  } catch (networkErr) {
    throw new Error('Network error fetching ' + url + ' — ' + networkErr.message);
  }

  if (!response.ok) {
    throw new Error(
      response.status === 404
        ? '404 for ' + url + ' — check specs/features/' + featureName + '.md exists and is committed'
        : 'HTTP ' + response.status + ' fetching ' + url
    );
  }

  const markdown = await response.text();

  if (markdown.trim().startsWith('<')) {
    throw new Error('Got HTML instead of markdown for ' + url + ' — file may be missing from repo');
  }

  const sections = {};
  for (const line of markdown.split('\n')) {
    if (line.startsWith('### CANONICAL-')) {
      const name = line.replace('### ', '').trim();
      const text = extractSection(markdown, name);
      if (text) sections[name] = text;
    }
  }

  console.log('[prompt-loader] Loaded ' + featureName + ' — sections: ' + Object.keys(sections).join(', '));
  return sections;
}

async function loadSimPrompts(featureNames) {
  const results = {};
  const errors = [];

  await Promise.all(
    featureNames.map(async (name) => {
      try {
        results[name] = await loadFeatureSpec(name);
      } catch (err) {
        errors.push(err.message);
        results[name] = {};
      }
    })
  );

  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }

  return results;
}
