(() => {
  const STORAGE_KEY = 'restar682:collapsed-aside-cards'

  const getCardKey = card => {
    if (card.id) return card.id
    return [...card.classList].find(name => name.startsWith('card-') && name !== 'card-widget')
  }

  const initAsideCollapse = () => {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {}

    document.querySelectorAll('#aside-content .card-widget').forEach(card => {
      const headline = card.querySelector(':scope > .item-headline')
      const key = getCardKey(card)
      if (!headline || !key || card.dataset.collapseReady === 'true') return

      card.dataset.collapseReady = 'true'
      card.classList.add('aside-collapsible')

      const button = document.createElement('button')
      button.className = 'aside-collapse-button'
      button.type = 'button'
      const icon = document.createElement('i')
      icon.className = 'fas fa-chevron-up aside-collapse-icon'
      icon.setAttribute('aria-hidden', 'true')
      button.append(icon)
      headline.append(button)

      const setCollapsed = collapsed => {
        card.classList.toggle('is-collapsed', collapsed)
        button.setAttribute('aria-expanded', String(!collapsed))
        button.title = collapsed ? '展开此栏' : '收起此栏'
        button.setAttribute('aria-label', button.title)
      }

      const toggle = () => {
        const collapsed = !card.classList.contains('is-collapsed')
        setCollapsed(collapsed)
      }

      button.addEventListener('click', toggle)

      setCollapsed(false)
    })
  }

  document.addEventListener('DOMContentLoaded', initAsideCollapse)
  document.addEventListener('pjax:complete', initAsideCollapse)
  if (document.readyState !== 'loading') initAsideCollapse()
})()
