'use strict';

const fs = require('fs');
const path = require('path');
const { imageSize } = require('image-size');

const IMAGE_FILE = /^(\d+)\.(?:jpe?g|png|webp|gif)$/i;

function interleaveByShape(images) {
    const regular = images.filter(image => !image.isWide);
    const wide = images.filter(image => image.isWide);
    const result = [];

    while (regular.length || wide.length) {
        result.push(...regular.splice(0, 2));
        if (wide.length) result.push(wide.shift());
    }

    return result;
}

function renderGallery() {
    const galleryDir = path.join(hexo.source_dir, 'other-images');
    const images = fs.readdirSync(galleryDir)
        .map(filename => {
            const match = filename.match(IMAGE_FILE);
            if (!match) return null;

            const { width, height } = imageSize(fs.readFileSync(path.join(galleryDir, filename)));
            if (!width || !height) {
                hexo.log.warn(`Could not read gallery image dimensions: ${filename}`);
                return null;
            }

            return {
                filename,
                number: Number(match[1]),
                width,
                height,
                isWide: width / height >= 1.3
            };
        })
        .filter(Boolean)
        .sort((a, b) => a.number - b.number || a.filename.localeCompare(b.filename));

    const figures = interleaveByShape(images).map(image => {
        const wideClass = image.isWide ? ' is-wide' : '';
        return `  <figure class="personal-gallery-item${wideClass}"><img src="/other-images/${image.filename}" width="${image.width}" height="${image.height}" alt="收藏图片 ${image.number}" loading="lazy" decoding="async"></figure>`;
    });

    return `<div class="personal-gallery">\n${figures.join('\n')}\n</div>`;
}

hexo.extend.filter.register('before_post_render', data => {
    if (!data.content.includes('<!-- personal-gallery -->')) return data;

    data.content = data.content.replace('<!-- personal-gallery -->', renderGallery());
    return data;
});
