'use strict';

const MATH_PATTERN = /\$\$|\\\[|\\\(|\\begin\{|(?<!\$)\$[^\r\n$]+\$(?!\$)/;

function assignMathjax(post) {
  if (typeof post.mathjax === 'boolean') return post;
  const source = post.raw || post._content || post.content || '';
  if (!MATH_PATTERN.test(source)) return post;

  if (typeof post.set === 'function') post.set('mathjax', true);
  else post.mathjax = true;
  return post;
}

hexo.extend.filter.register('before_generate', () => {
  hexo.locals.get('posts').forEach(assignMathjax);
});

hexo.extend.filter.register('before_post_render', assignMathjax, 1);
