(() => {
  'use strict';
  const article = document.getElementById('article');
  const container = document.getElementById('toc');
  const search = document.getElementById('toc-search');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');
  const mobileMenu = document.getElementById('open-sidebar');
  const closeMenu = document.getElementById('close-sidebar');
  const headings = [...article.querySelectorAll('h1, h2, h3')];
  const roots = [];
  const stack = [];
  const arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>';

  // 建立任意巢狀層級（最多 #、##、###），不必維護另一個目錄檔案。
  headings.forEach((heading, index) => {
    const level = Number(heading.tagName[1]);
    if (!heading.id) heading.id = `heading-${index + 1}`;
    const item = {id: heading.id, label: heading.textContent.trim(), level, children:[], element:heading};
    while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
    if (stack.length) stack[stack.length - 1].children.push(item);
    else roots.push(item);
    stack.push(item);
  });

  const allRows = [];
  function createItems(items) {
    const list = document.createElement('ul');
    items.forEach(item => {
      const li = document.createElement('li');
      li.className = `toc-level-${item.level}`;
      li.dataset.id = item.id;
      const node = document.createElement('div');
      node.className = 'toc-node';
      const caret = document.createElement('button');
      caret.type = 'button';
      caret.className = 'toc-caret';
      const expandable = item.children.length > 0;
      let childList = null;
      if (expandable) {
        caret.innerHTML = arrow;
        caret.setAttribute('aria-label', `展開或收合：${item.label}`);
        childList = createItems(item.children);
        childList.classList.add('toc-children');
        childList.id = `group-${allRows.length}-${item.id}`;
        caret.setAttribute('aria-controls', childList.id);
        const expanded = item.level === 1;
        caret.setAttribute('aria-expanded', String(expanded));
        childList.hidden = !expanded;
        caret.addEventListener('click', () => {
          const next = caret.getAttribute('aria-expanded') !== 'true';
          caret.setAttribute('aria-expanded', String(next));
          childList.hidden = !next;
        });
      } else {
        caret.classList.add('empty');
        caret.tabIndex = -1;
        caret.setAttribute('aria-hidden', 'true');
      }
      const link = document.createElement('a');
      link.textContent = item.label;
      link.href = `#${encodeURIComponent(item.id)}`;
      link.addEventListener('click', () => {
        closeDrawer();
        if (search.value) { search.value=''; filterAll(''); }
      });
      node.append(caret, link);
      li.append(node);
      if (childList) li.append(childList);
      list.append(li);
      allRows.push({item,li,caret,childList,link});
    });
    return list;
  }
  container.append(createItems(roots));
  const byId = new Map(allRows.map(row => [row.item.id,row]));

  function setAll(expanded) {
    allRows.forEach(({caret,childList}) => {
      if (!childList) return;
      caret.setAttribute('aria-expanded', String(expanded));
      childList.hidden = !expanded;
    });
  }
  document.getElementById('expand-all').addEventListener('click', () => setAll(true));
  document.getElementById('collapse-all').addEventListener('click', () => setAll(false));

  function filterAll(value) {
    const query = value.trim().toLocaleLowerCase();
    const recurse = (li) => {
      const row = byId.get(li.dataset.id);
      const own = row.item.label.toLocaleLowerCase().includes(query);
      const kids = row.childList ? [...row.childList.children] : [];
      // 如果上層本身符合搜尋，也應顯示下層全部結果。
      const matches = kids.map(child => recurse(child));
      const visible = !query || own || matches.some(Boolean);
      li.hidden = !visible;
      if (query && row.childList) {
        const expand = matches.some(Boolean) || own;
        row.caret.setAttribute('aria-expanded', String(expand));
        row.childList.hidden = !expand;
      }
      if (query && own) kids.forEach(c => c.hidden = false);
      return visible;
    };
    const results = [...container.firstElementChild.children].map(recurse);
    document.getElementById('no-matches').hidden = results.some(Boolean);
  }
  search.addEventListener('input', () => filterAll(search.value));
  document.addEventListener('keydown', event => {
    if (event.key === '/' && !['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) {
      event.preventDefault();
      if (window.innerWidth <= 800) openDrawer();
      search.focus();
    }
    if (event.key === 'Escape') closeDrawer();
  });

  function openDrawer() {
    sidebar.classList.add('open');
    overlay.hidden = false;
    mobileMenu.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }
  function closeDrawer() {
    sidebar.classList.remove('open');
    overlay.hidden = true;
    mobileMenu.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }
  mobileMenu.addEventListener('click', openDrawer);
  closeMenu.addEventListener('click', closeDrawer);
  overlay.addEventListener('click', closeDrawer);
  document.getElementById('back-top').addEventListener('click', () => window.scrollTo({top:0,behavior:'smooth'}));

  // 捲動時標記正在閱讀的章節。點連結時不強制變更收合狀態。
  function markActive() {
    const y = window.scrollY + 135;
    let active = headings[0];
    headings.forEach(el => { if (el.getBoundingClientRect().top + window.scrollY <= y) active = el; });
    allRows.forEach(row => row.li.classList.toggle('active', row.item.id === active?.id));
  }
  let pending = false;
  window.addEventListener('scroll', () => {
    if (pending) return;
    pending=true;
    requestAnimationFrame(() => {markActive();pending=false;});
  }, {passive:true});
  window.addEventListener('hashchange', markActive);
  markActive();
  // 直接由書籤開啟第三層標題時，展開所有祖先。
  function openHashParents() {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    const current = byId.get(id);
    if (!current) return;
    let li = current.li.parentElement?.closest('li');
    while (li) {
      const row = byId.get(li.dataset.id);
      if (row?.childList) {
        row.childList.hidden = false;
        row.caret.setAttribute('aria-expanded','true');
      }
      li = li.parentElement?.closest('li');
    }
  }
  window.addEventListener('hashchange', openHashParents);
  openHashParents();
})();
