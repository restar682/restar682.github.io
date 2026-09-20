(() => {
  const initGallery = () => {
    const grid = document.querySelector('.personal-gallery')
    if (!grid || grid.dataset.galleryReady === 'true') return

    grid.dataset.galleryReady = 'true'
    const items = [...grid.querySelectorAll('.personal-gallery-item')]
    const images = items.map(item => item.querySelector('img'))

    // Dimensions are generated with the page, before lazy images are downloaded.
    const aspectRatio = image => {
      const width = Number(image.getAttribute('width')) || image.naturalWidth
      const height = Number(image.getAttribute('height')) || image.naturalHeight
      return width && height ? width / height : 0
    }

    const layout = () => {
      const styles = getComputedStyle(grid)
      const rowHeight = parseFloat(styles.gridAutoRows)
      const rowGap = parseFloat(styles.rowGap)

      items.forEach((item, index) => {
        const image = images[index]
        const ratio = aspectRatio(image)
        if (!ratio) return
        item.classList.toggle('is-wide', ratio >= 1.3)
        const renderedHeight = item.getBoundingClientRect().width / ratio
        item.style.gridRowEnd = `span ${Math.ceil((renderedHeight + rowGap) / (rowHeight + rowGap))}`
      })
    }

    const regularItems = []
    const wideItems = []

    items.forEach((item, index) => {
      const image = images[index]
      const isWide = aspectRatio(image) >= 1.3
      item.classList.toggle('is-wide', isWide)
      ;(isWide ? wideItems : regularItems).push(item)

      const hideFailedImage = () => {
        item.hidden = true
        item.style.display = 'none'
      }
      image.addEventListener('load', layout, { once: true })
      image.addEventListener('error', hideFailedImage, { once: true })
      if (image.complete && !image.naturalWidth) hideFailedImage()
    })

    // Break up runs of similarly shaped images while retaining each group's order.
    while (regularItems.length || wideItems.length) {
      regularItems.splice(0, 2).forEach(item => grid.appendChild(item))
      if (wideItems.length) grid.appendChild(wideItems.shift())
    }

    grid.classList.add('is-ready')
    layout()
    new ResizeObserver(layout).observe(grid)
  }

  document.addEventListener('DOMContentLoaded', initGallery)
  document.addEventListener('pjax:complete', initGallery)
  if (document.readyState !== 'loading') initGallery()
})()
