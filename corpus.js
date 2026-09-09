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
    const labels = { running: '執行中', starting: '啟動中', draining: '停止接新任務，等待目前工作結束', completed: '本輪流程完成', completed_with_gaps: '本輪結束，仍有待處理項目', completed_with_unresolved_dependencies: '本輪結束，仍有未解跨集指涉', group_pilot_completed: '分組試跑結束', pilot_completed: '試跑通過', pilot_completed_with_gaps: '試跑有待處理項目', idle_no_pending_in_scope: '本次範圍沒有待執行項目', stopped_or_unconfirmed: '程序已停止或狀態未確認', crashed: '程序異常停止', not_started: '尚未啟動' };
    const label = labels[workflow.status] || (workflow.status?.startsWith('paused_') ? '已暫停，需檢查額度、時限或待處理問題' : '狀態待確認');
    const phase = workflow.phase === 'cross_episode_synthesis' ? '跨集歸納' : workflow.phase === 'cross_group_full_pair_check' ? '跨組雙集全文回查' : workflow.phase === 'finished' ? '流程收尾' : workflow.phase === 'grouped_episode_review' ? `分組讀稿／原文對照 · ${workflow.parallel_groups} 組並行 · ${workflow.groups_completed}/${workflow.total_groups} 組完成` : '逐集讀稿／覆核';
    document.getElementById('workflow-status').textContent = `${label} · ${phase} · 雙子agent已完成 ${data.counts.subagent_reviewed || 0} 集。資料更新：${new Date(data.updated_at_utc).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}（台灣時間）。`;
    const groupTarget = document.getElementById('group-list');
    const relations = { continuation: '延續', revision: '調整', contradiction: '矛盾候選', retrospective_claim: '事後回顧', uncertain: '關係待釐清' };
    function connectionBody(c, body) {
      body.append(element('p', `EP${c.from_episode} → EP${c.to_episode} · ${relations[c.relation] || c.relation}：${c.finding}`));
      body.append(element('p', `限制：${c.limitations}`, 'episode-caution'));
      const refs = element('p', '原稿快照定位：', 'refs');
      for (const r of c.evidence || []) {
        const a = element('a', ` EP${r.episode} L${r.start_line}–${r.end_line} `);
        a.href = `https://whatmkreallysaid.com/episode.html?file=EP${Number(r.episode)}`;
        a.title = `SHA256 ${r.source_sha256}；來源網站排版可能不同於保存的原稿快照。`; refs.append(a);
      }
      body.append(refs);
    }
    if (data.groups?.length && groupTarget) {
      groupTarget.replaceChildren();
      for (const g of data.groups) {
        const box = document.createElement('details'); box.id = `group-${g.id}`;
        box.append(element('summary', `${g.id} · ${g.members.map(n => `EP${n}`).join('、')}`));
        const body = element('div', '', 'card-body'); body.append(element('p', g.summary));
        if (g.missing_members.length) body.append(element('p', `本組尚缺：${g.missing_members.map(n => `EP${n}`).join('、')}`, 'episode-caution'));
        for (const t of g.timeline) body.append(element('p', `EP${t.episode}：${t.development}`));
        for (const c of g.connections) connectionBody(c, body);
        for (const t of g.takeaways) body.append(element('p', `研究價值：${t.insight}`), element('p', `限制：${t.limitation}`, 'muted'));
        for (const q of g.open_dependencies) body.append(element('p', `組內未解 EP${q.episode} → ${q.target_episode ? `EP${q.target_episode}` : '對象待辨識'}：${q.question}（${q.reason_unresolved}）。後續回查另見下方。`, 'episode-caution'));
        box.append(body); groupTarget.append(box);
      }
    }
    const depTarget = document.getElementById('dependency-list');
    if (data.dependency_checks?.length && depTarget) {
      depTarget.append(element('h3', '跨組回查／待查清單'));
      const depLabels = { pair_checked: '兩集全文已對照', pair_checked_still_uncertain: '全文對照後仍未解', needs_target_identification: '對象待辨識', deferred_check_limit: '超出本階段檢查上限，待查', paused: '已暫停', needs_attention: '覆核待處理' };
      for (const q of data.dependency_checks) {
        const box = document.createElement('details'); box.append(element('summary', `EP${q.episode} → ${q.target_episode ? `EP${q.target_episode}` : '未知'} · ${depLabels[q.status] || q.status}`));
        const body = element('div', '', 'card-body'); body.append(element('p', q.question));
        for (const c of q.findings || []) connectionBody(c, body);
        box.append(body); depTarget.append(box);
      }
    }
    const syntheses = data.syntheses || [];
    if (syntheses.length) {
      const target = document.getElementById('synthesis-list'); target.replaceChildren();
      const final = syntheses.filter(s => s.stage === 'final').slice(-1);
      const shown = final.length ? final : syntheses.slice(-3);
      if (!final.length) target.append(element('p', `已完成 ${syntheses.length} 個歸納分組；目前展示最近3組線索，尚在合併候選卡。`, 'muted'));
      else target.append(element('p', `本次知識庫：${final[0].document.patterns.length}張卡。依買進、賣出、持有、證據與風險分類；卡片仍是暫定研究框架，不代表交易績效已驗證。`, 'status'));
      for (const s of shown) {
        target.append(element('h3', s.document.title), element('p', s.scope, 'muted'), element('p', s.document.summary));
        for (const p of s.document.patterns) {
          const box = document.createElement('details'); const body = document.createElement('div'); body.className = 'card-body';
          box.append(element('summary', `${p.card_id ? `#${p.card_id} · ` : ''}${p.title}`));
          const novelty = { new: '新決策問題候選', specialization: '舊框架的情境細分', revision: '舊框架修訂候選', overlap: '與前期框架重疊' };
          body.append(element('p', `${p.category ? `分類：${p.category} · ` : ''}${novelty[p.baseline_relationship] || '與前期卡關係待判定'}`, 'status'));
          for (const [key, prefix] of [['decision_question', '決策問題'], ['conditions', '適用條件'], ['failure_conditions', '失效／限制'], ['interpretation', '研究價值'], ['difference_from_baseline', '與前期卡差異']]) body.append(element('p', `${prefix}：${p[key]}`));
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
