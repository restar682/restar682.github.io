'use strict';

const SERIES_RULES = [
  [/^MIT-6[.-]S081(?:-Lab\d+|总结)/i, 'MIT 6.S081'],
  [/^CS143(?:-Week\d+|-PA\d+|总结)/i, 'CS143'],
  [/^计网学习笔记-\d+$/, '计算机网络'],
  [/^UCAS-nlp-Week\d+/i, 'UCAS NLP'],
  [/^k大构成L\d+$/, 'k大构成'],
  [/^k大色彩L\d+$/, 'k大色彩'],
  [/^斑斓之镇L\d+笔记$/, '斑斓之镇']
];

function assignSeries(post) {
  if (post.series) return post;

  const match = SERIES_RULES.find(([pattern]) => pattern.test(post.title));
  if (!match) return post;

  if (typeof post.set === 'function') post.set('series', match[1]);
  else post.series = match[1];
  return post;
}

hexo.extend.filter.register('before_generate', () => {
  hexo.locals.get('posts').forEach(assignSeries);
});

hexo.extend.filter.register('before_post_render', assignSeries, 1);
