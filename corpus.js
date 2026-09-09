'use strict';
(() => {
  const el = (tag, text = '', className = '') => {
    const node = document.createElement(tag);
    node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  // Learning content is static HTML. Search/pagination enhance it even if JSON fails.
  const cards = [...document.querySelectorAll('#synthesis-list > .knowledge-card')];
  const search = document.getElementById('knowledge-search');
  const category = document.getElementById('knowledge-category');
  const result = document.getElementById('knowledge-result');
  const more = document.getElementById('knowledge-more');
  const topics = [...document.querySelectorAll('[data-topic]')];
  let cardLimit = 12;
  const cardText = new Map(cards.map(c => [c, c.textContent.toLowerCase()]));
  function filterCards() {
    const q = search.value.trim().toLowerCase();
    const matches = cards.filter(c => (!category.value || c.dataset.category === category.value) && (!q || cardText.get(c).includes(q)));
    const visible = new Set(matches.slice(0, cardLimit));
    cards.forEach(c => { c.hidden = !visible.has(c); });
    result.textContent = matches.length ? `符合 ${matches.length} 張，目前顯示 ${visible.size} 張。點標題展開。` : '沒有符合的卡片，試試別的關鍵字或切回全部主題。';
    more.hidden = visible.size >= matches.length;
    topics.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.topic === category.value)));
  }
  document.getElementById('knowledge-controls').hidden = false;
  document.getElementById('knowledge-topics').hidden = false;
  search.addEventListener('input', () => { cardLimit = 12; filterCards(); });
  category.addEventListener('change', () => { cardLimit = 12; filterCards(); });
  topics.forEach(b => b.addEventListener('click', () => {
    category.value = b.dataset.topic; search.value = ''; cardLimit = 12; filterCards();
  }));
  more.addEventListener('click', () => { cardLimit += 12; filterCards(); });
  const cases = [...document.querySelectorAll('#case-list > .case-study')];
  const caseSearch = document.getElementById('case-search');
  const caseCategory = document.getElementById('case-category');
  const caseMore = document.getElementById('case-more');
  const caseResult = document.getElementById('case-result');
  const caseText = new Map(cases.map(c => [c, c.textContent.toLowerCase()]));
  let caseLimit = 6;
  function filterCases() {
    const q = caseSearch.value.trim().toLowerCase();
    const matches = cases.filter(c => (!caseCategory.value || c.dataset.category === caseCategory.value) && (!q || caseText.get(c).includes(q)));
    const visible = new Set(matches.slice(0, caseLimit));
    cases.forEach(c => { c.hidden = !visible.has(c); });
    caseResult.textContent = matches.length ? `符合 ${matches.length} 個案例，目前顯示 ${visible.size} 個。` : '沒有符合的案例，試試公司名稱或切回全部案例。';
    caseMore.hidden = visible.size >= matches.length;
  }
  document.getElementById('case-controls').hidden = false;
  caseSearch.addEventListener('input', () => { caseLimit = 6; filterCases(); });
  caseCategory.addEventListener('change', () => { caseLimit = 6; filterCases(); });
  caseMore.addEventListener('click', () => { caseLimit += 6; filterCases(); });
  filterCases();
  function revealHash() {
    const node = document.getElementById(location.hash.slice(1));
    if (!node) return;
    const card = node.closest('.knowledge-card');
    if (card) {
      search.value = ''; category.value = ''; cardLimit = Math.max(cardLimit, cards.indexOf(card) + 1);
      filterCards();
    }
    const study = node.closest('.case-study');
    if (study) {
      caseSearch.value = ''; caseCategory.value = ''; caseLimit = Math.max(caseLimit, cases.indexOf(study) + 1);
      filterCases();
    }
    for (let parent = node; parent; parent = parent.parentElement) {
      if (parent.tagName === 'DETAILS') parent.open = true;
    }
    requestAnimationFrame(() => node.scrollIntoView({ block: 'start' }));
  }
  filterCards();
  window.addEventListener('hashchange', revealHash);
  revealHash();

  const status = document.getElementById('episode-result');
  const episodeMore = document.getElementById('episode-more');
  async function loadResearch() {
    try {
      const response = await fetch('corpus.json');
      if (!response.ok) throw new Error('Unable to load research');
      const data = await response.json();
      if (!Array.isArray(data.episodes)) throw new Error('Invalid research');
      const workflow = data.workflow || {};
      const labels = { running: '執行中', completed: '本輪流程完成', completed_with_unresolved_dependencies: '本輪結束，仍有未解跨集指涉', completed_with_gaps: '本輪結束，仍有待處理項目' };
      const label = labels[workflow.status] || (workflow.status?.startsWith('paused_') ? '已暫停' : '請查研究狀態');
      document.getElementById('workflow-status').textContent = `${label} · ${workflow.groups_completed}/${workflow.total_groups} 組完成 · 最多 ${workflow.parallel_groups} 組並行。資料更新：${new Date(data.updated_at_utc).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}。這是研究快照，不是即時程序狀態。`;
      const list = document.getElementById('episode-list');
      const episodeSearch = document.getElementById('episode-search');
      const year = document.getElementById('episode-year');
      const state = document.getElementById('episode-status');
      let visible = 24;
      [...new Set(data.episodes.map(e => e.date?.slice(0, 4)).filter(Boolean))].sort().forEach(y => year.append(new Option(y, y)));
      function renderEpisodes() {
        const q = episodeSearch.value.trim().toLowerCase();
        const matches = data.episodes.filter(e => `ep${e.episode} ${e.date || ''}`.includes(q) && (!year.value || e.date?.startsWith(year.value)) &&
          (state.value === 'all' || (state.value === 'read' && e.read) || (state.value === 'pending' && !e.read) ||
          (state.value === 'partial' && e.validation === 'partial') || (state.value === 'agents' && e.review_method === 'two_subagents') ||
          (state.value === 'attention' && e.processing_status === 'needs_attention')));
        list.replaceChildren();
        for (const e of matches.slice(0, visible)) {
          const article = document.createElement('article');
          article.append(el('h3', `EP${e.episode}`), el('p', `${e.date || '日期待查'} · ${e.review_method === 'two_subagents' ? '雙子agent筆記' : '主助理筆記'}`, 'status'));
          article.append(el('p', e.summary || '尚未完成讀稿，不提供推測性摘要。'));
          if (e.caution) article.append(el('p', e.caution, 'episode-caution'));
          if (e.key_points?.length) {
            const details = document.createElement('details');
            details.append(el('summary', `重要判斷與引用（${e.key_points.length}項）`));
            const body = el('div', '', 'card-body');
            const actors = { host: '主持人', listener: '聽眾', third_party: '第三方', unclear: '主體不清楚' };
            const kinds = { observation: '觀察／轉述', forecast: '預測', plan: '計畫', self_reported_action: '操作自述', third_party_report: '第三方轉述', principle: '原則', uncertain: '待釐清' };
            for (const c of e.key_points) {
              body.append(el('p', `${c.id} · ${actors[c.actor] || c.actor}／${kinds[c.kind] || c.kind}`, 'status'), el('p', c.statement), el('p', `條件：${c.condition}`, 'muted'), el('p', `限制：${c.limitation}`, 'episode-caution'));
            }
            for (const c of e.card_links || []) {
              const row = el('p', `${c.claim_id}：${c.reason} `, 'refs');
              const link = el('a', `查看相關卡片 ${c.card_id}`); link.href = `#card-${Number(c.card_id)}`; row.append(link); body.append(row);
            }
            details.append(body); article.append(details);
          }
          const link = el('a', '前往原稿來源 →', 'episode-source');
          link.href = `https://whatmkreallysaid.com/episode.html?file=EP${Number(e.episode)}`;
          article.append(link); list.append(article);
        }
        status.textContent = matches.length ? `符合 ${matches.length} 集，目前顯示 ${Math.min(visible, matches.length)} 集。` : '沒有符合的集數，請調整篩選條件。';
        episodeMore.hidden = visible >= matches.length;
      }
      for (const control of [episodeSearch, year, state]) control.addEventListener(control === episodeSearch ? 'input' : 'change', () => { visible = 24; renderEpisodes(); });
      episodeMore.addEventListener('click', () => { visible += 24; renderEpisodes(); });
      renderEpisodes();
      const relations = { continuation: '延續', revision: '調整', contradiction: '矛盾候選', retrospective_claim: '事後回顧', uncertain: '關係待釐清' };
      function appendConnection(c, body) {
        body.append(el('p', `EP${c.from_episode} → EP${c.to_episode} · ${relations[c.relation] || c.relation}：${c.finding}`), el('p', `限制：${c.limitations}`, 'episode-caution'));
        const refs = el('p', '原稿快照定位：', 'refs');
        for (const r of c.evidence || []) {
          const a = el('a', ` EP${r.episode} L${r.start_line}–${r.end_line} `);
          a.href = `https://whatmkreallysaid.com/episode.html?file=EP${Number(r.episode)}`;
          a.title = `SHA256 ${r.source_sha256}；來源網站排版可能不同於原稿快照。`; refs.append(a);
        }
        body.append(refs);
      }
      function renderGroups() {
        const target = document.getElementById('group-list');
        const depTarget = document.getElementById('dependency-list');
        if (target.dataset.loaded) return;
        target.dataset.loaded = 'true';
        for (const g of data.groups || []) {
          const box = document.createElement('details'); box.id = `group-${g.id}`;
          box.append(el('summary', `${g.id} · ${g.members.map(n => `EP${n}`).join('、')}`));
          const body = el('div', '', 'card-body'); body.append(el('p', g.summary));
          if (g.missing_members?.length) body.append(el('p', `本組尚缺：${g.missing_members.join('、')}`, 'episode-caution'));
          for (const t of g.timeline || []) body.append(el('p', `EP${t.episode}：${t.development}`));
          for (const c of g.connections || []) appendConnection(c, body);
          for (const t of g.takeaways || []) body.append(el('p', t.insight), el('p', `限制：${t.limitation}`, 'muted'));
          for (const q of g.open_dependencies || []) body.append(el('p', `EP${q.episode} → ${q.target_episode || '對象待辨識'}：${q.question}（${q.reason_unresolved}）`, 'episode-caution'));
          box.append(body); target.append(box);
        }
        const depLabels = { pair_checked: '兩集全文已對照', pair_checked_still_uncertain: '全文對照後仍未解', needs_target_identification: '對象待辨識', deferred_check_limit: '超出本階段檢查上限', paused: '已暫停', needs_attention: '覆核待處理' };
        depTarget.append(el('h3', '跨組回查／待查清單'));
        for (const q of data.dependency_checks || []) {
          const box = document.createElement('details'); box.append(el('summary', `EP${q.episode} → ${q.target_episode || '未知'} · ${depLabels[q.status] || q.status}`));
          const body = el('div', '', 'card-body'); body.append(el('p', q.question));
          for (const c of q.findings || []) appendConnection(c, body);
          box.append(body); depTarget.append(box);
        }
      }
      const groups = document.getElementById('group-research');
      groups.addEventListener('toggle', () => { if (groups.open) renderGroups(); });
      if (groups.open) renderGroups();
      // Keep existing group deep links usable without putting the logs before the lessons.
      if (location.hash.startsWith('#group-')) { groups.open = true; renderGroups(); revealHash(); }
    } catch {
      status.textContent = '研究資料暫時無法載入；上方90張知識卡與42個案例仍可閱讀與搜尋。';
      episodeMore.hidden = true;
    }
  }
  loadResearch();
})();
