'use strict';
const { filter } = hexo.extend;
const cheerio = require('cheerio');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

hexo.extend.generator.register('vendor/fontawesome/css/all.min.css', () => ({
    path: 'vendor/fontawesome/css/all.min.css',
    data: fs.readFileSync(path.join(hexo.base_dir, 'node_modules/@fortawesome/fontawesome-free/css/all.min.css'))
}));

hexo.extend.generator.register('vendor/fontawesome/webfonts', () => {
    const sourceDir = path.join(hexo.base_dir, 'node_modules/@fortawesome/fontawesome-free/webfonts');
    return fs.readdirSync(sourceDir).map(name => ({
        path: `vendor/fontawesome/webfonts/${name}`,
        data: fs.readFileSync(path.join(sourceDir, name))
    }));
});

const styleVersions = new Map();

function versionedStyleUrl(name) {
    const sourcePath = path.join(hexo.source_dir, 'css', `${name}.styl`);
    const stat = fs.statSync(sourcePath);
    const cacheKey = `${stat.mtimeMs}:${stat.size}`;
    const cached = styleVersions.get(name);

    if (cached && cached.cacheKey === cacheKey) return cached.url;

    const version = crypto
        .createHash('sha256')
        .update(fs.readFileSync(sourcePath))
        .digest('hex')
        .slice(0, 12);
    const url = `/css/${name}.css?v=${version}`;
    styleVersions.set(name, { cacheKey, url });
    return url;
}

function versionCustomStyles(html) {
    return html.replace(
        /\/css\/(corgi|modify)\.css(?:\?[^"']*)?/g,
        (_, name) => versionedStyleUrl(name)
    );
}

/**
 * 在页面插入新顶部图
 * @param {cheerio.Root} $ Root
 */
function insertTopImg($) {
    const header = $('#page-header');
    if (header.length === 0) return;
    const background = header.css('background-image');
    if (!background) return;
    $('#post, #page, #archive, #tag, #category').prepend(`<div class="top-img" style="background-image: ${background};"></div>`);
}

// 修改 HTML
filter.register('after_render:html', (str, data) => {
    const $ = cheerio.load(str, {
        decodeEntities: false
    });
    insertTopImg($);
    $('.personal-gallery img').attr('loading', 'lazy');
    return versionCustomStyles($.html());
});
