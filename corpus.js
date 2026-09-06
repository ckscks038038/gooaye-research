'use strict';
(async () => {
  const status = document.getElementById('episode-result');
  const list = document.getElementById('episode-list');
  const search = document.getElementById('episode-search');
  const year = document.getElementById('episode-year');
  const state = document.getElementById('episode-status');
  const more = document.getElementById('episode-more');
  let visible = 24;
  const element = (tag, text, className) => {
    const node = document.createElement(tag);
    node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  try {
    const response = await fetch('corpus.json');
    if (!response.ok) throw new Error('Unable to load progress');
    const data = await response.json();
    if (!Array.isArray(data.episodes)) throw new Error('Invalid progress');
    const years = [...new Set(data.episodes.map(e => e.date?.slice(0, 4)).filter(Boolean))].sort();
    for (const value of years) {
      const option = element('option', value);
      option.value = value;
      year.append(option);
    }
    function render() {
      const query = search.value.trim().toLowerCase();
      const matches = data.episodes.filter(e => {
        const text = `ep${e.episode} ${e.date || ''}`;
        return text.includes(query) && (!year.value || e.date?.startsWith(year.value)) &&
          (state.value === 'all' || (state.value === 'read' && e.read) ||
           (state.value === 'pending' && !e.read) || (state.value === 'partial' && e.validation === 'partial'));
      });
      list.replaceChildren();
      for (const e of matches.slice(0, visible)) {
        const article = document.createElement('article');
        const heading = document.createElement('div');
        heading.className = 'episode-heading';
        heading.append(element('h3', `EP${e.episode}`));
        heading.append(element('span', e.read ? '已讀／已整理' : (e.downloaded ? '已下載／待讀' : '待下載／待讀'), `tag ${e.read ? 'done' : 'pending'}`));
        article.append(heading, element('p', `${e.date || '日期待查'} · ${e.validation === 'partial' ? '部分價格／官方消息已核' : '未完成獨立外部核驗'}`, 'muted'));
        if (e.read && e.summary) {
          article.append(element('p', e.summary));
          if (e.caution) article.append(element('p', `核驗／限制：${e.caution}`, 'episode-caution'));
        } else {
          article.append(element('p', '尚未完整閱讀，因此不提供推測性摘要。', 'muted'));
        }
        const link = element('a', '前往原稿來源 →', 'episode-source');
        link.href = `https://whatmkreallysaid.com/episode.html?file=EP${Number(e.episode)}`;
        article.append(link);
        list.append(article);
      }
      status.textContent = matches.length ? `符合 ${matches.length} 集，目前顯示 ${Math.min(visible, matches.length)} 集。` : '沒有符合的集數，請調整篩選條件。';
      more.hidden = matches.length <= visible;
    }
    for (const control of [search, year, state]) {
      control.addEventListener(control === search ? 'input' : 'change', () => { visible = 24; render(); });
    }
    more.addEventListener('click', () => { visible += 24; render(); });
    render();
  } catch {
    status.textContent = '暫時無法載入逐集清單，請重新整理。上方知識卡及案例仍可閱讀。';
    more.hidden = true;
  }
})();
