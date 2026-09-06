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
    const workflow = data.workflow || {};
    const labels = { running: '執行中', starting: '啟動中', draining: '停止接新任務，等待目前工作結束', completed: '本輪流程完成', completed_with_gaps: '本輪結束，仍有待處理項目', pilot_completed: '試跑通過', pilot_completed_with_gaps: '試跑有待處理項目', idle_no_pending_in_scope: '本次範圍沒有待執行項目', stopped_or_unconfirmed: '程序已停止或狀態未確認', crashed: '程序異常停止', not_started: '尚未啟動' };
    const label = labels[workflow.status] || (workflow.status?.startsWith('paused_') ? '已暫停，需檢查額度、時限或待處理問題' : '狀態待確認');
    const phase = workflow.phase === 'cross_episode_synthesis' ? '跨集歸納' : workflow.phase === 'finished' ? '流程收尾' : '逐集讀稿／覆核';
    document.getElementById('workflow-status').textContent = `${label} · ${phase} · 雙子agent已完成 ${data.counts.subagent_reviewed || 0} 集。資料更新：${new Date(data.updated_at_utc).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}（台灣時間）。`;
    const syntheses = data.syntheses || [];
    if (syntheses.length) {
      const target = document.getElementById('synthesis-list'); target.replaceChildren();
      const final = syntheses.filter(s => s.stage === 'final');
      const shown = final.length ? final : syntheses.slice(-3);
      if (!final.length) target.append(element('p', `已完成 ${syntheses.length} 個分組；目前展示最近3組，尚非全量最終整合。`, 'muted'));
      for (const s of shown) {
        target.append(element('h3', s.document.title), element('p', s.scope, 'muted'), element('p', s.document.summary));
        for (const p of s.document.patterns) {
          const box = document.createElement('details'); const body = document.createElement('div'); body.className = 'card-body';
          box.append(element('summary', p.title));
          for (const [key, prefix] of [['decision_question', '決策問題'], ['conditions', '適用條件'], ['failure_conditions', '失效／限制'], ['interpretation', '研究價值']]) body.append(element('p', `${prefix}：${p[key]}`));
          for (const [key, prefix] of [['supporting_refs', '支持／案例'], ['counter_refs', '反例／限制案例']]) {
            const row = element('p', `${prefix}：`, 'refs');
            for (const r of p[key]) { const a = element('a', ` EP${r.episode}／${r.claim_id} `); a.href = `https://whatmkreallysaid.com/episode.html?file=EP${Number(r.episode)}`; row.append(a); }
            if (!p[key].length) row.append(document.createTextNode('未列具體反例，不代表不存在。'));
            body.append(row);
          }
          body.append(element('p', '候選歸納；引用代碼對應逐集筆記，不代表外部事實或策略效果已驗證。', 'status'));
          box.append(body); target.append(box);
        }
        for (const q of s.document.open_questions) target.append(element('p', `待查：${q}`, 'muted'));
      }
    }
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
           (state.value === 'pending' && !e.read) || (state.value === 'partial' && e.validation === 'partial') ||
           (state.value === 'agents' && e.review_method === 'two_subagents') ||
           (state.value === 'attention' && e.processing_status === 'needs_attention'));
      });
      list.replaceChildren();
      for (const e of matches.slice(0, visible)) {
        const article = document.createElement('article');
        const heading = document.createElement('div');
        heading.className = 'episode-heading';
        heading.append(element('h3', `EP${e.episode}`));
        const badge = e.review_method === 'two_subagents' ? '雙子agent覆核通過' : e.read ? '主助理直接讀稿' : e.processing_status === 'needs_attention' ? '待人工處理' : e.processing_status === 'in_progress' ? '子agent處理中' : e.downloaded ? '已下載／待處理' : '待下載／待處理';
        heading.append(element('span', badge, `tag ${e.read ? 'done' : 'pending'}`));
        article.append(heading, element('p', `${e.date || '日期待查'} · ${e.validation === 'partial' ? '部分價格／官方消息已核' : '未完成獨立外部核驗'}`, 'muted'));
        if (e.read && e.summary) {
          article.append(element('p', e.summary));
          if (e.caution) article.append(element('p', `核驗／限制：${e.caution}`, 'episode-caution'));
          if (e.key_points?.length) {
            const details = document.createElement('details');
            details.append(element('summary', `重要判斷與候選卡片關聯（${e.key_points.length}項）`));
            const body = document.createElement('div'); body.className = 'card-body';
            const actors = { host: '主持人', listener: '聽眾', third_party: '第三方', unclear: '主體不清楚' };
            const kinds = { observation: '觀察／轉述', forecast: '預測', plan: '計畫', self_reported_action: '操作自述', third_party_report: '第三方轉述', principle: '原則', uncertain: '待釐清' };
            for (const c of e.key_points) {
              body.append(element('p', `${c.id} · ${actors[c.actor] || c.actor}／${kinds[c.kind] || c.kind}`, 'status'));
              body.append(element('p', c.statement), element('p', `條件：${c.condition}`, 'muted'), element('p', `限制：${c.limitation}`, 'episode-caution'));
            }
            const relations = { supports: '支持候選', limits: '限縮', contradicts: '衝突候選', extends: '延伸候選' };
            for (const c of e.card_links || []) {
              const row = element('p', `${relations[c.relationship]} · ${c.claim_id}：${c.reason} `);
              const a = element('a', `查看卡片 ${c.card_id}`); a.href = `#card-${Number(c.card_id)}`; row.append(a); body.append(row);
            }
            details.append(body); article.append(details);
          }
        } else {
          article.append(element('p', '尚未完成讀稿及覆核，因此不提供推測性摘要。', 'muted'));
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
