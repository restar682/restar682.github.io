'use strict';

const { parse } = require('hexo-front-matter');
// Discover repeated title stems from the corpus. There are no course names or
// chapter-label words here: Latin words, numbers and punctuation are boundaries.
const NUMBER = /^(?:\d+|[零〇一二三四五六七八九十百千万两]+)$/u;
const SEPARATOR = /^[\p{P}\p{Z}\s]+$/u;
const LATIN = /^[a-z]+$/i;
const HAN = /\p{Script=Han}/u;

function tokenize(title) {
  return [...title.normalize('NFKC').matchAll(/\d+|[零〇一二三四五六七八九十百千万两]+|[a-z]+|[\p{P}\p{Z}\s]+|./giu)]
    .map(match => ({
      text: match[0],
      key: SEPARATOR.test(match[0]) ? '-' : match[0].toLowerCase(),
      number: NUMBER.test(match[0]),
      separator: SEPARATOR.test(match[0])
    }));
}

const keyOf = tokens => JSON.stringify(tokens.map(token => token.key));
const nameOf = tokens => tokens.map(token => token.text).join('').trim();
const lengthOf = tokens => tokens.filter(token => !token.separator)
  .reduce((length, token) => length + [...token.text].length, 0);
const startsWith = (tokens, prefix) => prefix.every((token, i) => tokens[i]?.key === token.key);

function trimSeparators(tokens) {
  while (tokens.at(-1)?.separator) tokens.pop();
  return tokens;
}

function sufficientStem(tokens, numbered) {
  if (lengthOf(tokens) >= 4) return true;
  // Two Chinese characters with changing chapter numbers provide stronger
  // evidence than two letters or a short coincidental prose prefix.
  return numbered && (nameOf(tokens).match(/\p{Script=Han}/gu) || []).length >= 2;
}

function hasLaterNumber(tokens, index) {
  for (const token of tokens.slice(index + 1)) {
    // Numbers in the subtitle are content, not part of the series hierarchy.
    if (token.separator && /[:：]/u.test(token.text)) break;
    if (token.number) return true;
  }
  return false;
}

function detectSeries(posts) {
  const entries = posts.map(post => ({ post, tokens: tokenize(post.title || '') }));
  const prefixes = new Map();

  // Only branching prefixes are candidates. Whole number/word tokens prevent
  // Week1 and Week10 from accidentally forming a separate "Week1" series.
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i].tokens;
      const b = entries[j].tokens;
      let end = 0;
      while (a[end] && b[end] && a[end].key === b[end].key) end++;
      if (!end || !a[end] || !b[end]) continue;
      const prefix = a.slice(0, end);
      prefixes.set(keyOf(prefix), prefix);
    }
  }

  const candidates = new Map();
  for (const prefix of prefixes.values()) {
    const members = entries.filter(entry => startsWith(entry.tokens, prefix));
    const next = members.map(entry => entry.tokens[prefix.length]).filter(Boolean);
    const numbered = next.length >= 2 && next.every(token => token.number);
    const separated = prefix.at(-1).separator;
    let stem = trimSeparators(prefix.slice());

    if (numbered) {
      // A varying edition/course number above another chapter number is not
      // evidence for merging editions, even when each has only one article.
      if (members.some(entry => hasLaterNumber(entry.tokens, prefix.length))) continue;
      // Learn a shared chapter label from its position, regardless of its text.
      // e.g. Topic-Session1/2, Topic-Week1/2, 主题L1/2, 主题第一/二章.
      const last = stem.at(-1);
      const beforeLast = stem.at(-2);
      const detachedLabel = beforeLast?.separator && /[-_–—]/u.test(beforeLast.text);
      const attachedLabel = beforeLast && !beforeLast.separator && HAN.test(beforeLast.text);
      if (last?.text === '第' || (LATIN.test(last?.text || '') && (detachedLabel || attachedLabel))) {
        const shorter = trimSeparators(stem.slice(0, -1));
        if (sufficientStem(shorter, true)) stem = shorter;
      }
    }

    if (!sufficientStem(stem, numbered)) continue;
    const unique = new Set(members.map(entry => keyOf(entry.tokens)));
    if (unique.size < 2) continue;

    // A boundary or varying number is strong structural evidence. Without one,
    // require three titles and a substantial common Chinese title stem.
    if (!numbered && !separated) {
      if (unique.size < 3 || !HAN.test(stem.at(-1).text)) continue;
      if (members.some(entry => lengthOf(stem) / lengthOf(entry.tokens) < 0.5)) continue;
    }

    const key = keyOf(stem);
    const candidate = candidates.get(key) || { stem, members: new Set(), minimum: 3 };
    members.forEach(entry => candidate.members.add(entry));
    candidate.minimum = Math.min(candidate.minimum, numbered || separated ? 2 : 3);
    candidates.set(key, candidate);
  }

  const assignments = new Map();
  const accepted = [];
  // Specific stems win: two numbered courses must not collapse into a shared
  // author name, or into one course when their edition numbers differ.
  const ordered = [...candidates.values()].sort((a, b) =>
    lengthOf(b.stem) - lengthOf(a.stem) || keyOf(a.stem).localeCompare(keyOf(b.stem)));
  for (const candidate of ordered) {
    const available = [...candidate.members].filter(entry => !assignments.has(entry.post));
    if (new Set(available.map(entry => keyOf(entry.tokens))).size < candidate.minimum) continue;
    const names = new Map();
    for (const entry of available) {
      const name = nameOf(entry.tokens.slice(0, candidate.stem.length));
      names.set(name, (names.get(name) || 0) + 1);
    }
    const name = [...names].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
    available.forEach(entry => assignments.set(entry.post, name));
    accepted.push({ ...candidate, name });
  }

  // Only a title equal to the established series name, or an explicitly named
  // summary, can join without providing its own grouping evidence. A matching
  // prefix alone must not absorb an unrelated article.
  for (const entry of entries) {
    if (assignments.has(entry.post)) continue;
    const group = accepted.find(candidate => {
      if (!startsWith(entry.tokens, candidate.stem)) return false;
      const remainder = nameOf(entry.tokens.slice(candidate.stem.length))
        .replace(/^[\p{P}\p{Z}\s]+/u, '');
      return remainder === '' || remainder === '总结';
    });
    if (group) assignments.set(entry.post, group.name);
  }
  return assignments;
}

async function assignDetectedSeries() {
  hexo.locals.invalidate();
  const posts = hexo.locals.get('posts').toArray();
  // Only source front matter is authoritative. Previously inferred values in
  // db.json must not become permanent manual assignments on the next build.
  const manual = new Map(posts.map(post => [post, parse(post.raw || '').series]));
  const automatic = detectSeries(posts.filter(post => manual.get(post) == null));
  await Promise.all(posts.map(post => {
    const explicit = manual.get(post);
    const series = explicit == null ? automatic.get(post) : explicit;
    if (post.series === series) return undefined;
    return series == null
      ? post.update({ $unset: { series: true } })
      : post.update({ series });
  }));
  hexo.locals.invalidate();
}

// Run before Hexo renders posts (priority 10) so fresh article copies and the
// page generators both receive the same assignments, including on rebuilds.
hexo.extend.filter.register('before_generate', assignDetectedSeries, 5);
