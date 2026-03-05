// ==UserScript==
// @name         Gemini Chat 问题侧边栏导航
// @namespace    https://github.com/kevinyin/BetterGeminiChat
// @version      1.2.0
// @description  在 Gemini Chat 右侧添加问题列表侧边栏，点击可快速跳转到对应问题位置
// @author       kevinyin
// @match        https://gemini.google.com/*
// @include      https://gemini.google.com/*
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const SIDEBAR_WIDTH = 260;

  GM_addStyle(`
    #gemini-nav-sidebar {
      position: fixed;
      top: 0;
      right: 0;
      width: ${SIDEBAR_WIDTH}px;
      height: 100vh;
      background: #f8f9fa;
      border-left: 1px solid #e0e0e0;
      z-index: 99999;
      display: flex;
      flex-direction: column;
      font-family: 'Google Sans', 'Roboto', -apple-system, BlinkMacSystemFont, sans-serif;
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    #gemini-nav-sidebar.collapsed {
      transform: translateX(${SIDEBAR_WIDTH}px);
    }

    #gemini-nav-sidebar .sidebar-header {
      padding: 14px 16px;
      border-bottom: 1px solid #e0e0e0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
      background: #fff;
    }

    #gemini-nav-sidebar .sidebar-header h3 {
      margin: 0;
      font-size: 14px;
      font-weight: 500;
      color: #1f1f1f;
      letter-spacing: 0.1px;
    }

    #gemini-nav-sidebar .sidebar-header .question-count {
      font-size: 11px;
      color: #5f6368;
      background: #e8eaed;
      padding: 2px 8px;
      border-radius: 12px;
      font-weight: 500;
    }

    #gemini-nav-sidebar .sidebar-list {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
      scrollbar-width: thin;
      scrollbar-color: #dadce0 transparent;
    }

    #gemini-nav-sidebar .sidebar-list::-webkit-scrollbar {
      width: 4px;
    }

    #gemini-nav-sidebar .sidebar-list::-webkit-scrollbar-track {
      background: transparent;
    }

    #gemini-nav-sidebar .sidebar-list::-webkit-scrollbar-thumb {
      background: #dadce0;
      border-radius: 2px;
    }

    #gemini-nav-sidebar .sidebar-list::-webkit-scrollbar-thumb:hover {
      background: #bdc1c6;
    }

    #gemini-nav-sidebar .nav-item {
      padding: 10px 12px;
      margin-bottom: 2px;
      border-radius: 12px;
      cursor: pointer;
      color: #3c4043;
      font-size: 13px;
      line-height: 1.4;
      display: flex;
      align-items: flex-start;
      gap: 10px;
      transition: background 0.15s ease;
    }

    #gemini-nav-sidebar .nav-item:hover {
      background: #e8eaed;
    }

    #gemini-nav-sidebar .nav-item.active {
      background: #d3e3fd;
      color: #1967d2;
    }

    #gemini-nav-sidebar .nav-item .item-index {
      flex-shrink: 0;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #5f6368;
      border-radius: 50%;
      font-size: 11px;
      font-weight: 500;
      background: #e8eaed;
    }

    #gemini-nav-sidebar .nav-item.active .item-index {
      background: #1967d2;
      color: #fff;
    }

    #gemini-nav-sidebar .nav-item .item-text {
      flex: 1;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      word-break: break-all;
    }

    #gemini-nav-toggle {
      position: fixed;
      top: 50%;
      right: ${SIDEBAR_WIDTH}px;
      transform: translateY(-50%);
      z-index: 100000;
      width: 20px;
      height: 48px;
      background: #f8f9fa;
      border: 1px solid #e0e0e0;
      border-right: none;
      border-radius: 8px 0 0 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #5f6368;
      font-size: 12px;
      transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1), background 0.15s ease;
    }

    #gemini-nav-toggle:hover {
      background: #e8eaed;
      color: #1f1f1f;
    }

    #gemini-nav-toggle.collapsed {
      right: 0;
    }

    #gemini-nav-sidebar .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 200px;
      color: #80868b;
      font-size: 13px;
      text-align: center;
      padding: 20px;
    }

    #gemini-nav-sidebar .empty-state .empty-icon {
      margin-bottom: 12px;
      opacity: 0.4;
      font-size: 32px;
    }
  `);

  const USER_QUERY_SEL = 'user-query-content';
  const QUERY_TEXT_SEL = '.query-text-line';
  const SCROLL_CONTAINER_SEL = 'infinite-scroller';

  let sidebar, listEl, toggleBtn, countEl;
  let isCollapsed = false;
  let activeItemIdx = -1;
  let isScrolling = false;
  let lastMessageFingerprint = '';

  function createSidebar() {
    sidebar = document.createElement('div');
    sidebar.id = 'gemini-nav-sidebar';

    const header = document.createElement('div');
    header.className = 'sidebar-header';

    const title = document.createElement('h3');
    title.textContent = '问题导航';

    countEl = document.createElement('span');
    countEl.className = 'question-count';
    countEl.textContent = '0';

    header.appendChild(title);
    header.appendChild(countEl);

    listEl = document.createElement('div');
    listEl.className = 'sidebar-list';

    sidebar.appendChild(header);
    sidebar.appendChild(listEl);
    document.body.appendChild(sidebar);

    listEl.addEventListener('click', (e) => {
      const navItem = e.target.closest('.nav-item');
      if (!navItem) return;
      const idx = parseInt(navItem.dataset.index, 10);
      if (isNaN(idx)) return;

      e.preventDefault();
      e.stopPropagation();

      activeItemIdx = idx;
      updateActiveHighlight();
      scrollToMessage(idx);
    });

    toggleBtn = document.createElement('div');
    toggleBtn.id = 'gemini-nav-toggle';
    toggleBtn.textContent = '\u25C0';
    toggleBtn.title = '收起/展开问题导航';
    document.body.appendChild(toggleBtn);

    toggleBtn.addEventListener('click', () => {
      isCollapsed = !isCollapsed;
      sidebar.classList.toggle('collapsed', isCollapsed);
      toggleBtn.classList.toggle('collapsed', isCollapsed);
      toggleBtn.textContent = isCollapsed ? '\u25B6' : '\u25C0';
    });
  }

  function getUserMessages() {
    const queryElements = document.querySelectorAll(USER_QUERY_SEL);
    const results = [];
    queryElements.forEach((el) => {
      const textLines = el.querySelectorAll(QUERY_TEXT_SEL);
      let text = '';
      if (textLines.length > 0) {
        text = Array.from(textLines)
          .map((line) => line.textContent.trim())
          .filter((t) => t.length > 0)
          .join(' ');
      }
      if (!text) {
        text = el.textContent.trim();
      }
      if (text) {
        results.push({ element: el, text: text });
      }
    });
    return results;
  }

  function scrollToMessage(idx) {
    const messages = getUserMessages();
    if (idx < 0 || idx >= messages.length) return;

    const target = messages[idx].element;
    if (!target) return;

    isScrolling = true;

    target.scrollIntoView({ behavior: 'smooth', block: 'start' });

    target.style.transition = 'background 0.3s ease';
    target.style.background = 'rgba(66, 133, 244, 0.12)';
    target.style.borderRadius = '12px';
    setTimeout(() => {
      target.style.background = '';
      setTimeout(() => {
        target.style.transition = '';
        target.style.borderRadius = '';
      }, 300);
    }, 1500);

    setTimeout(() => { isScrolling = false; }, 1000);
  }

  function highlightActiveByScroll() {
    if (isScrolling) return;

    const messages = getUserMessages();
    if (messages.length === 0) return;

    const viewportMid = window.innerHeight * 0.3;

    let closestIdx = 0;
    let closestDist = Infinity;

    messages.forEach((msg, idx) => {
      const rect = msg.element.getBoundingClientRect();
      const dist = Math.abs(rect.top - viewportMid);
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = idx;
      }
    });

    if (closestIdx !== activeItemIdx) {
      activeItemIdx = closestIdx;
      updateActiveHighlight();
    }
  }

  function updateActiveHighlight() {
    const items = listEl.querySelectorAll('.nav-item');
    items.forEach((item, idx) => {
      item.classList.toggle('active', idx === activeItemIdx);
    });

    const activeItem = items[activeItemIdx];
    if (activeItem) {
      const listRect = listEl.getBoundingClientRect();
      const itemRect = activeItem.getBoundingClientRect();
      if (itemRect.top < listRect.top || itemRect.bottom > listRect.bottom) {
        activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }

  function createNavItem(text, idx) {
    const item = document.createElement('div');
    item.className = 'nav-item' + (idx === activeItemIdx ? ' active' : '');
    item.dataset.index = idx;

    const indexSpan = document.createElement('span');
    indexSpan.className = 'item-index';
    indexSpan.textContent = String(idx + 1);

    const textSpan = document.createElement('span');
    textSpan.className = 'item-text';
    textSpan.textContent = text;

    item.appendChild(indexSpan);
    item.appendChild(textSpan);
    return item;
  }

  function createEmptyState() {
    const container = document.createElement('div');
    container.className = 'empty-state';

    const icon = document.createElement('div');
    icon.className = 'empty-icon';
    icon.textContent = '\uD83D\uDCAC';

    const hint = document.createElement('span');
    hint.textContent = '暂无问题';

    const sub = document.createElement('span');
    sub.textContent = '开始对话后这里会显示问题列表';
    sub.style.fontSize = '12px';
    sub.style.marginTop = '4px';

    container.appendChild(icon);
    container.appendChild(hint);
    container.appendChild(sub);
    return container;
  }

  function renderList() {
    if (isScrolling) return;

    const messages = getUserMessages();
    const fingerprint = messages.map((m) => m.text.substring(0, 50)).join('|');

    if (fingerprint === lastMessageFingerprint) return;
    lastMessageFingerprint = fingerprint;

    countEl.textContent = String(messages.length);

    while (listEl.firstChild) {
      listEl.removeChild(listEl.firstChild);
    }

    if (messages.length === 0) {
      listEl.appendChild(createEmptyState());
      return;
    }

    messages.forEach((msg, idx) => {
      listEl.appendChild(createNavItem(msg.text, idx));
    });
  }

  let debounceTimer = null;
  function debouncedRender() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(renderList, 500);
  }

  function setupScrollListener() {
    let scrollTimer = null;

    const scrollEl = document.querySelector(SCROLL_CONTAINER_SEL) ||
      document.querySelector('#chat-history') ||
      document.querySelector('.conversation-container');

    const targets = [scrollEl, window].filter(Boolean);
    targets.forEach((t) => {
      t.addEventListener(
        'scroll',
        () => {
          clearTimeout(scrollTimer);
          scrollTimer = setTimeout(highlightActiveByScroll, 150);
        },
        { passive: true, capture: true }
      );
    });
  }

  function init() {
    createSidebar();
    renderList();

    const observer = new MutationObserver((mutations) => {
      const isOwnChange = mutations.every(
        (m) => sidebar.contains(m.target) || toggleBtn.contains(m.target)
      );
      if (isOwnChange) return;
      debouncedRender();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    setupScrollListener();

    setInterval(() => {
      const container = document.querySelector(SCROLL_CONTAINER_SEL);
      if (container && !container.__geminiNavBound) {
        container.__geminiNavBound = true;
        setupScrollListener();
      }
    }, 1000);

    highlightActiveByScroll();
  }

  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init);
  }
})();
