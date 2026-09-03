(() => {
  const initGallery = () => {
    const grid = document.querySelector('.personal-gallery')
    if (!grid || grid.dataset.galleryReady === 'true') return

    grid.dataset.galleryReady = 'true'
    const items = [...grid.querySelectorAll('.personal-gallery-item')]
    const images = items.map(item => item.querySelector('img'))

    const layout = () => {
      const styles = getComputedStyle(grid)
      const rowHeight = parseFloat(styles.gridAutoRows)
      const rowGap = parseFloat(styles.rowGap)

      items.forEach((item, index) => {
        const image = images[index]
        const ratio = image.naturalWidth / image.naturalHeight
        item.classList.toggle('is-wide', ratio >= 1.3)
      })

      items.forEach((item, index) => {
        const image = images[index]
        const renderedHeight = item.getBoundingClientRect().width * image.naturalHeight / image.naturalWidth
        item.style.gridRowEnd = `span ${Math.ceil((renderedHeight + rowGap) / (rowHeight + rowGap))}`
      })
    }

    Promise.all(images.map(image => {
      if (image.complete && image.naturalWidth) return Promise.resolve()
      return new Promise(resolve => {
        image.addEventListener('load', resolve, { once: true })
        image.addEventListener('error', resolve, { once: true })
      })
    })).then(() => {
      const regularItems = []
      const wideItems = []

      items.forEach((item, index) => {
        const image = images[index]
        const isWide = image.naturalWidth / image.naturalHeight >= 1.3
        item.classList.toggle('is-wide', isWide)
        ;(isWide ? wideItems : regularItems).push(item)
      })

      // Break up runs of similarly shaped images while retaining each group's order.
      while (regularItems.length || wideItems.length) {
        regularItems.splice(0, 2).forEach(item => grid.appendChild(item))
        if (wideItems.length) grid.appendChild(wideItems.shift())
      }

      grid.classList.add('is-ready')
      requestAnimationFrame(layout)
      new ResizeObserver(layout).observe(grid)
    })
  }

  document.addEventListener('DOMContentLoaded', initGallery)
  document.addEventListener('pjax:complete', initGallery)
  if (document.readyState !== 'loading') initGallery()
})()
