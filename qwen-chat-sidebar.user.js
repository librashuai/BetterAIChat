// ==UserScript==
// @name         Qwen Chat 问题侧边栏导航
// @namespace    https://github.com/kevinyin/BetterQwenChat
// @version      1.2.0
// @description  在 Qwen Chat 右侧添加问题列表侧边栏，点击可快速跳转到对应问题位置
// @author       kevinyin
// @match        https://chat.qwen.ai/*
// @include      https://chat.qwen.ai/*
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  GM_addStyle(`
    #qwen-nav-sidebar {
      position: fixed;
      top: 0;
      right: 0;
      width: 280px;
      height: 100vh;
      background: #ffffff;
      border-left: 1px solid #e8e8ed;
      z-index: 99999;
      display: flex;
      flex-direction: column;
      font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Segoe UI', Roboto, sans-serif;
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: -2px 0 12px rgba(0, 0, 0, 0.06);
    }

    #qwen-nav-sidebar.collapsed {
      transform: translateX(280px);
    }

    #qwen-nav-sidebar .sidebar-header {
      padding: 16px;
      border-bottom: 1px solid #e8e8ed;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }

    #qwen-nav-sidebar .sidebar-header h3 {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
      color: #1d1d1f;
    }

    #qwen-nav-sidebar .sidebar-header .question-count {
      font-size: 12px;
      color: #6e6e73;
      background: #f2f2f7;
      padding: 2px 8px;
      border-radius: 10px;
      font-weight: 500;
    }

    #qwen-nav-sidebar .sidebar-list {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
      scrollbar-width: thin;
      scrollbar-color: #c7c7cc transparent;
    }

    #qwen-nav-sidebar .sidebar-list::-webkit-scrollbar {
      width: 6px;
    }

    #qwen-nav-sidebar .sidebar-list::-webkit-scrollbar-track {
      background: transparent;
    }

    #qwen-nav-sidebar .sidebar-list::-webkit-scrollbar-thumb {
      background: #c7c7cc;
      border-radius: 3px;
    }

    #qwen-nav-sidebar .sidebar-list::-webkit-scrollbar-thumb:hover {
      background: #a1a1a6;
    }

    #qwen-nav-sidebar .nav-item {
      padding: 10px 12px;
      margin-bottom: 4px;
      border-radius: 8px;
      cursor: pointer;
      color: #3c3c43;
      font-size: 13px;
      line-height: 1.5;
      display: flex;
      align-items: flex-start;
      gap: 8px;
      transition: background 0.15s ease, color 0.15s ease;
      border: 1px solid transparent;
    }

    #qwen-nav-sidebar .nav-item:hover {
      background: #f2f2f7;
      color: #1d1d1f;
      border-color: #e5e5ea;
    }

    #qwen-nav-sidebar .nav-item.active {
      background: #eef2ff;
      color: #5b5fc7;
      border-color: #c7d2fe;
    }

    #qwen-nav-sidebar .nav-item .item-index {
      flex-shrink: 0;
      width: 22px;
      height: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f2f2f7;
      color: #6e6e73;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
    }

    #qwen-nav-sidebar .nav-item.active .item-index {
      background: #dbeafe;
      color: #5b5fc7;
    }

    #qwen-nav-sidebar .nav-item .item-text {
      flex: 1;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      word-break: break-all;
    }

    #qwen-nav-toggle {
      position: fixed;
      top: 50%;
      right: 280px;
      transform: translateY(-50%);
      z-index: 100000;
      width: 24px;
      height: 56px;
      background: #ffffff;
      border: 1px solid #e8e8ed;
      border-right: none;
      border-radius: 8px 0 0 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #8e8e93;
      font-size: 14px;
      transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1), background 0.15s ease, color 0.15s ease;
      box-shadow: -2px 0 8px rgba(0, 0, 0, 0.06);
    }

    #qwen-nav-toggle:hover {
      background: #f2f2f7;
      color: #1d1d1f;
    }

    #qwen-nav-toggle.collapsed {
      right: 0;
    }

    #qwen-nav-sidebar .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 200px;
      color: #8e8e93;
      font-size: 13px;
      text-align: center;
      padding: 20px;
    }

    #qwen-nav-sidebar .empty-state svg {
      margin-bottom: 12px;
      opacity: 0.5;
    }
  `);

  const SCROLL_CONTAINER_SEL = '#chat-messages-scroll-container';
  const USER_MSG_CONTENT_SEL = '.user-message-content';
  const USER_MSG_WRAPPER_SEL = '[id^="qwen-chat-message-user-"]';

  let sidebar, listEl, toggleBtn, countEl;
  let isCollapsed = false;
  let activeItemIdx = -1;
  let isScrolling = false;
  let lastMessageIds = '';

  function createSidebar() {
    sidebar = document.createElement('div');
    sidebar.id = 'qwen-nav-sidebar';
    sidebar.innerHTML = `
      <div class="sidebar-header">
        <h3>问题导航</h3>
        <span class="question-count">0</span>
      </div>
      <div class="sidebar-list"></div>
    `;
    document.body.appendChild(sidebar);

    listEl = sidebar.querySelector('.sidebar-list');
    countEl = sidebar.querySelector('.question-count');

    listEl.addEventListener('click', (e) => {
      const navItem = e.target.closest('.nav-item');
      if (!navItem) return;
      const messageId = navItem.dataset.messageId;
      const idx = parseInt(navItem.dataset.index, 10);
      if (!messageId || isNaN(idx)) return;

      e.preventDefault();
      e.stopPropagation();

      activeItemIdx = idx;
      updateActiveHighlight();
      scrollToMessage(messageId);
    });

    toggleBtn = document.createElement('div');
    toggleBtn.id = 'qwen-nav-toggle';
    toggleBtn.innerHTML = '◀';
    toggleBtn.title = '收起/展开问题导航';
    document.body.appendChild(toggleBtn);

    toggleBtn.addEventListener('click', () => {
      isCollapsed = !isCollapsed;
      sidebar.classList.toggle('collapsed', isCollapsed);
      toggleBtn.classList.toggle('collapsed', isCollapsed);
      toggleBtn.innerHTML = isCollapsed ? '▶' : '◀';
    });
  }

  function getUserMessages() {
    const wrappers = document.querySelectorAll(USER_MSG_WRAPPER_SEL);
    const results = [];
    wrappers.forEach((wrapper) => {
      const contentEl = wrapper.querySelector(USER_MSG_CONTENT_SEL);
      if (contentEl) {
        results.push({ id: wrapper.id, text: contentEl.textContent.trim() });
      }
    });
    return results;
  }

  function scrollToMessage(messageId) {
    const wrapper = document.getElementById(messageId);
    if (!wrapper) return;

    isScrolling = true;

    const scrollContainer = document.querySelector(SCROLL_CONTAINER_SEL);
    if (!scrollContainer) {
      wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => { isScrolling = false; }, 1000);
      return;
    }

    const containerRect = scrollContainer.getBoundingClientRect();
    const wrapperRect = wrapper.getBoundingClientRect();
    const targetTop = wrapperRect.top - containerRect.top + scrollContainer.scrollTop - 80;

    scrollContainer.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });

    wrapper.style.transition = 'background 0.3s ease';
    wrapper.style.background = '#eef2ff';
    setTimeout(() => {
      wrapper.style.background = '';
      setTimeout(() => { wrapper.style.transition = ''; }, 300);
    }, 1500);

    setTimeout(() => { isScrolling = false; }, 1000);
  }

  function highlightActiveByScroll() {
    if (isScrolling) return;

    const scrollContainer = document.querySelector(SCROLL_CONTAINER_SEL);
    if (!scrollContainer) return;

    const messages = getUserMessages();
    if (messages.length === 0) return;

    const containerRect = scrollContainer.getBoundingClientRect();
    const viewportMid = containerRect.top + containerRect.height * 0.3;

    let closestIdx = 0;
    let closestDist = Infinity;

    messages.forEach((msg, idx) => {
      const el = document.getElementById(msg.id);
      if (!el) return;
      const rect = el.getBoundingClientRect();
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

  function renderList() {
    if (isScrolling) return;

    const messages = getUserMessages();
    const currentIds = messages.map(m => m.id).join(',');

    if (currentIds === lastMessageIds) return;
    lastMessageIds = currentIds;

    countEl.textContent = messages.length;

    if (messages.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <span>暂无问题<br>开始对话后这里会显示问题列表</span>
        </div>
      `;
      return;
    }

    listEl.innerHTML = '';
    messages.forEach((msg, idx) => {
      const item = document.createElement('div');
      item.className = 'nav-item' + (idx === activeItemIdx ? ' active' : '');
      item.dataset.messageId = msg.id;
      item.dataset.index = idx;
      item.innerHTML = `
        <span class="item-index">${idx + 1}</span>
        <span class="item-text">${escapeHTML(msg.text)}</span>
      `;
      listEl.appendChild(item);
    });
  }

  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  let debounceTimer = null;
  function debouncedRender() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(renderList, 500);
  }

  function setupScrollListener() {
    let scrollTimer = null;
    const scrollContainer = document.querySelector(SCROLL_CONTAINER_SEL);
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', () => {
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(highlightActiveByScroll, 150);
      }, { passive: true });
    }
  }

  function init() {
    createSidebar();
    renderList();

    const observer = new MutationObserver((mutations) => {
      const isOwnChange = mutations.every(m =>
        sidebar.contains(m.target) || toggleBtn.contains(m.target)
      );
      if (isOwnChange) return;
      debouncedRender();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    setupScrollListener();

    setInterval(() => {
      const container = document.querySelector(SCROLL_CONTAINER_SEL);
      if (container && !container.__qwenNavBound) {
        container.__qwenNavBound = true;
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
