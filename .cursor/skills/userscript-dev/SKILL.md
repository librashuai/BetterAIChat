---
name: userscript-dev
description: 在 Cursor Browser Tab 中开发和调试油猴脚本（Tampermonkey/Greasemonkey userscript）。通过 JavaScript 注入方式模拟油猴脚本执行，无需安装扩展即可实时调试。当用户需要开发、调试、修复油猴脚本时使用此技能。
---

# Userscript 开发调试

在 Cursor 内置浏览器中开发和调试油猴脚本，通过 `javascript:void(...)` 注入方式模拟脚本执行。

## 开发流程

### 1. 打开目标页面

在 Cursor Browser Tab 中导航到目标网站：

```
browser_navigate → 目标URL
```

### 2. 分析页面 DOM 结构

使用 `javascript:void()` 注入诊断代码，检查选择器是否匹配：

```javascript
// 检查元素是否存在
javascript:void(document.title=JSON.stringify({
  count: document.querySelectorAll('target-selector').length,
  hasScroller: !!document.querySelector('infinite-scroller')
}))
```

**关键原则**：
- 用 `document.title` 回传诊断数据（snapshot 可读取 title）
- 一次检查多个选择器，减少注入次数
- 检查是否有 Shadow DOM 阻挡

### 3. 检查 CSP 限制

通过 `browser_console_messages` 查看是否有 CSP 报错：

```
browser_console_messages → 检查是否有 Trusted Types / CSP 错误
```

**常见 CSP 问题及解决方案**：

| CSP 限制 | 症状 | 解决方案 |
|---------|------|---------|
| Trusted Types | `innerHTML` 赋值被阻止 | 使用 DOM API: `createElement` + `textContent` + `appendChild` |
| script-src | 外部脚本无法加载 | 油猴的 `@grant` 可绕过，但调试时需要内联 |
| style-src | 动态样式被阻止 | `GM_addStyle` 由油猴注入，通常不受限制 |

### 4. 注入测试

分步注入脚本功能，从简单到复杂：

**Step 1 — 验证注入可行性**：
```javascript
javascript:void((function(){
  var d=document.createElement('div');
  d.id='test-inject';
  d.style.cssText='position:fixed;top:10px;right:10px;z-index:999999;background:red;color:white;padding:20px;font-size:16px;border-radius:8px';
  d.textContent='Injected OK';
  document.body.appendChild(d);
  document.title='INJECTED'
})())
```

**Step 2 — 注入样式**：
```javascript
javascript:void((function(){
  var s=document.createElement('style');
  s.textContent='...CSS rules...';
  document.head.appendChild(s);
})())
```

**Step 3 — 注入 UI 元素和逻辑**：
使用 DOM API 而非 innerHTML（避免 Trusted Types 限制）。

### 5. 截图验证

```
browser_take_screenshot → 确认视觉效果
```

### 6. 清理测试元素

```javascript
javascript:void((function(){
  var e=document.getElementById('test-inject');
  if(e)e.remove();
  document.title='原始标题';
})())
```

## 关键注意事项

### DOM 操作必须避免 innerHTML

很多现代网站（Google 系列、GitHub 等）启用了 Trusted Types CSP。

**禁止**：
```javascript
element.innerHTML = '<div>content</div>';
```

**正确**：
```javascript
var div = document.createElement('div');
div.textContent = 'content';
parent.appendChild(div);
```

清空子元素也不能用 `innerHTML = ''`：
```javascript
while (el.firstChild) el.removeChild(el.firstChild);
```

### 滚动容器探测

很多 SPA 使用自定义滚动容器（如 `overflow: hidden` + JS 控制），`scrollTo` 可能不生效。

**探测方法**：
```javascript
// 沿祖先链查找 scrollHeight > clientHeight 的元素
javascript:void((function(){
  var el = document.querySelector('target');
  var p = el;
  while(p && p !== document.body) {
    if(p.scrollHeight > p.clientHeight)
      { document.title='Scrollable:'+p.tagName+'#'+p.id; break; }
    p = p.parentElement;
  }
})())
```

**最可靠的滚动方式**：
```javascript
element.scrollIntoView({ behavior: 'smooth', block: 'start' });
```

### 祖先链诊断

检查目标元素的完整 DOM 路径：
```javascript
javascript:void((function(){
  var el = document.querySelector('target');
  var chain = [];
  var p = el;
  while(p && p !== document.body) {
    chain.push(p.tagName + (p.id ? '#'+p.id : ''));
    p = p.parentElement;
  }
  document.title = JSON.stringify(chain.slice(0, 8));
})())
```

### GM_* API 差异

在 Browser Tab 中无法使用 `GM_addStyle`、`GM_getValue` 等油猴 API。调试时需要用原生等价方式：

| GM API | 原生替代 |
|--------|---------|
| `GM_addStyle(css)` | `document.head.appendChild(style)` |
| `GM_getValue(key)` | `localStorage.getItem(key)` |
| `GM_setValue(key, val)` | `localStorage.setItem(key, val)` |
| `GM_xmlhttpRequest` | `fetch()` |

### URL 长度限制

`javascript:void(...)` 有 URL 长度限制。对于大型脚本：
- 分步注入（先样式，再结构，再逻辑）
- 压缩变量名和空白
- 分多次 `browser_navigate` 调用
