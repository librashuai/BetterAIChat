// ==UserScript==
// @name         ChatGPT 问题侧边栏导航
// @namespace    https://github.com/kevinyin/BetterChatGPT
// @version      1.0.0
// @description  在 ChatGPT 右侧添加问题列表侧边栏，点击可快速跳转到对应问题位置
// @author       kevinyin
// @match        https://chatgpt.com/*
// @include      https://chatgpt.com/*
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const SIDEBAR_WIDTH = 260;

  GM_addStyle(`
    #chatgpt-nav-sidebar {
      position: fixed;
      top: 0;
      right: 0;
      width: ${SIDEBAR_WIDTH}px;
      height: 100vh;
      background: #f7f7f8;
      border-left: 1px solid #e5e5e5;
      z-index: 99999;
      display: flex;
      flex-direction: column;
      font-family: 'Söhne', 'Helvetica Neue', -apple-system, BlinkMacSystemFont, sans-serif;
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    #chatgpt-nav-sidebar.collapsed {
      transform: translateX(${SIDEBAR_WIDTH}px);
    }

    #chatgpt-nav-sidebar .sidebar-header {
      padding: 14px 16px;
      border-bottom: 1px solid #e5e5e5;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
      background: #fff;
    }

    #chatgpt-nav-sidebar .sidebar-header h3 {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
      color: #0d0d0d;
      letter-spacing: -0.01em;
    }

    #chatgpt-nav-sidebar .sidebar-header .question-count {
      font-size: 11px;
      color: #6e6e80;
      background: #ececf1;
      padding: 2px 8px;
      border-radius: 12px;
      font-weight: 500;
    }

    #chatgpt-nav-sidebar .sidebar-list {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
      scrollbar-width: thin;
      scrollbar-color: #d9d9e3 transparent;
    }

    #chatgpt-nav-sidebar .sidebar-list::-webkit-scrollbar {
      width: 4px;
    }

    #chatgpt-nav-sidebar .sidebar-list::-webkit-scrollbar-track {
      background: transparent;
    }

    #chatgpt-nav-sidebar .sidebar-list::-webkit-scrollbar-thumb {
      background: #d9d9e3;
      border-radius: 2px;
    }

    #chatgpt-nav-sidebar .sidebar-list::-webkit-scrollbar-thumb:hover {
      background: #c5c5d2;
    }

    #chatgpt-nav-sidebar .nav-item {
      padding: 10px 12px;
      margin-bottom: 2px;
      border-radius: 10px;
      cursor: pointer;
      color: #353740;
      font-size: 13px;
      line-height: 1.4;
      display: flex;
      align-items: flex-start;
      gap: 10px;
      transition: background 0.15s ease;
    }

    #chatgpt-nav-sidebar .nav-item:hover {
      background: #ececf1;
    }

    #chatgpt-nav-sidebar .nav-item.active {
      background: #d1e7dd;
      color: #10a37f;
    }

    #chatgpt-nav-sidebar .nav-item .item-index {
      flex-shrink: 0;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #6e6e80;
      border-radius: 50%;
      font-size: 11px;
      font-weight: 500;
      background: #ececf1;
    }

    #chatgpt-nav-sidebar .nav-item.active .item-index {
      background: #10a37f;
      color: #fff;
    }

    #chatgpt-nav-sidebar .nav-item .item-text {
      flex: 1;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      word-break: break-all;
    }

    #chatgpt-nav-toggle {
      position: fixed;
      top: 50%;
      right: ${SIDEBAR_WIDTH}px;
      transform: translateY(-50%);
      z-index: 100000;
      width: 20px;
      height: 48px;
      background: #f7f7f8;
      border: 1px solid #e5e5e5;
      border-right: none;
      border-radius: 8px 0 0 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #6e6e80;
      font-size: 12px;
      transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1), background 0.15s ease;
    }

    #chatgpt-nav-toggle:hover {
      background: #ececf1;
      color: #0d0d0d;
    }

    #chatgpt-nav-toggle.collapsed {
      right: 0;
    }

    #chatgpt-nav-sidebar .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 200px;
      color: #8e8ea0;
      font-size: 13px;
      text-align: center;
      padding: 20px;
    }

    #chatgpt-nav-sidebar .empty-state .empty-icon {
      margin-bottom: 12px;
      opacity: 0.4;
      font-size: 32px;
    }
  `);

  const USER_MSG_SEL = '[data-message-author-role="user"]';

  let sidebar, listEl, toggleBtn, countEl;
  let isCollapsed = false;
  let activeItemIdx = -1;
  let isScrolling = false;
  let lastMessageFingerprint = '';

  function createSidebar() {
    sidebar = document.createElement('div');
    sidebar.id = 'chatgpt-nav-sidebar';

    var header = document.createElement('div');
    header.className = 'sidebar-header';

    var title = document.createElement('h3');
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

    listEl.addEventListener('click', function (e) {
      var navItem = e.target.closest('.nav-item');
      if (!navItem) return;
      var idx = parseInt(navItem.dataset.index, 10);
      if (isNaN(idx)) return;

      e.preventDefault();
      e.stopPropagation();

      activeItemIdx = idx;
      updateActiveHighlight();
      scrollToMessage(idx);
    });

    toggleBtn = document.createElement('div');
    toggleBtn.id = 'chatgpt-nav-toggle';
    toggleBtn.textContent = '\u25C0';
    toggleBtn.title = '收起/展开问题导航';
    document.body.appendChild(toggleBtn);

    toggleBtn.addEventListener('click', function () {
      isCollapsed = !isCollapsed;
      sidebar.classList.toggle('collapsed', isCollapsed);
      toggleBtn.classList.toggle('collapsed', isCollapsed);
      toggleBtn.textContent = isCollapsed ? '\u25B6' : '\u25C0';
    });
  }

  function getUserMessages() {
    var elements = document.querySelectorAll(USER_MSG_SEL);
    var results = [];
    elements.forEach(function (el) {
      var text = el.textContent.trim();
      if (text) {
        results.push({ element: el, text: text });
      }
    });
    return results;
  }

  function scrollToMessage(idx) {
    var messages = getUserMessages();
    if (idx < 0 || idx >= messages.length) return;

    var target = messages[idx].element;
    if (!target) return;

    isScrolling = true;

    target.scrollIntoView({ behavior: 'smooth', block: 'start' });

    target.style.transition = 'background 0.3s ease';
    target.style.background = 'rgba(16, 163, 127, 0.12)';
    target.style.borderRadius = '12px';
    setTimeout(function () {
      target.style.background = '';
      setTimeout(function () {
        target.style.transition = '';
        target.style.borderRadius = '';
      }, 300);
    }, 1500);

    setTimeout(function () { isScrolling = false; }, 1000);
  }

  function highlightActiveByScroll() {
    if (isScrolling) return;

    var messages = getUserMessages();
    if (messages.length === 0) return;

    var viewportMid = window.innerHeight * 0.3;

    var closestIdx = 0;
    var closestDist = Infinity;

    messages.forEach(function (msg, idx) {
      var rect = msg.element.getBoundingClientRect();
      var dist = Math.abs(rect.top - viewportMid);
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
    var items = listEl.querySelectorAll('.nav-item');
    items.forEach(function (item, idx) {
      item.classList.toggle('active', idx === activeItemIdx);
    });

    var activeItem = items[activeItemIdx];
    if (activeItem) {
      var listRect = listEl.getBoundingClientRect();
      var itemRect = activeItem.getBoundingClientRect();
      if (itemRect.top < listRect.top || itemRect.bottom > listRect.bottom) {
        activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }

  function createNavItem(text, idx) {
    var item = document.createElement('div');
    item.className = 'nav-item' + (idx === activeItemIdx ? ' active' : '');
    item.dataset.index = idx;

    var indexSpan = document.createElement('span');
    indexSpan.className = 'item-index';
    indexSpan.textContent = String(idx + 1);

    var textSpan = document.createElement('span');
    textSpan.className = 'item-text';
    textSpan.textContent = text;

    item.appendChild(indexSpan);
    item.appendChild(textSpan);
    return item;
  }

  function createEmptyState() {
    var container = document.createElement('div');
    container.className = 'empty-state';

    var icon = document.createElement('div');
    icon.className = 'empty-icon';
    icon.textContent = '\uD83D\uDCAC';

    var hint = document.createElement('span');
    hint.textContent = '暂无问题';

    var sub = document.createElement('span');
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

    var messages = getUserMessages();
    var fingerprint = messages.map(function (m) { return m.text.substring(0, 50); }).join('|');

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

    messages.forEach(function (msg, idx) {
      listEl.appendChild(createNavItem(msg.text, idx));
    });
  }

  var debounceTimer = null;
  function debouncedRender() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(renderList, 500);
  }

  function findScrollContainer() {
    var main = document.querySelector('main');
    if (!main) return null;
    var parent = main.parentElement;
    while (parent && parent !== document.body) {
      var style = getComputedStyle(parent);
      if (parent.scrollHeight > parent.clientHeight + 10 &&
          (style.overflowY === 'auto' || style.overflowY === 'scroll')) {
        return parent;
      }
      parent = parent.parentElement;
    }
    return null;
  }

  function setupScrollListener() {
    var scrollTimer = null;

    var scrollEl = findScrollContainer();

    var targets = [scrollEl, window].filter(Boolean);
    targets.forEach(function (t) {
      t.addEventListener(
        'scroll',
        function () {
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

    var observer = new MutationObserver(function (mutations) {
      var isOwnChange = mutations.every(function (m) {
        return sidebar.contains(m.target) || toggleBtn.contains(m.target);
      });
      if (isOwnChange) return;
      debouncedRender();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    setupScrollListener();

    setInterval(function () {
      var container = findScrollContainer();
      if (container && !container.__chatgptNavBound) {
        container.__chatgptNavBound = true;
        setupScrollListener();
      }
    }, 2000);

    highlightActiveByScroll();
  }

  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init);
  }
})();
