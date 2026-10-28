(function () {
  "use strict";
  const data = window.COURSE_DATA;
  if (!data || data.lessons.length !== 200) {
    document.getElementById("storage-status").textContent = "课程数据未载入，请保持整个文件夹完整，或打开每日教材。";
    return;
  }
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const list = (items, cls) => `<ul${cls ? ` class="${cls}"` : ""}>${items.map((v) => `<li>${esc(v)}</li>`).join("")}</ul>`;
  const KEY = "mba-emba-soft-skills-200-v1";
  let records = {}, current = 1, initialized = false, stored = true, running = false, segment = 0, remaining = 900, endAt = 0, interval = null;
  const segments = [{ label: "核心知识", minutes: 15 }, { label: "案例与模拟", minutes: 25 }, { label: "行动与反思", minutes: 20 }];
  try {
    const loaded = JSON.parse(localStorage.getItem(KEY) || "{}");
    if (loaded.version === 1 && loaded.records) records = validateRecords(loaded.records);
    localStorage.setItem(KEY, JSON.stringify({ version: 1, records }));
  } catch (err) {
    stored = false;
  }
  function validateRecords(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("记录格式无效");
    const result = {};
    const strings = ["date", "evidenceType", "artifact", "evidence", "action", "reflection", "grader"];
    for (const [key, value] of Object.entries(input)) {
      if (!/^\d+$/.test(key) || +key < 1 || +key > 200 || !value || typeof value !== "object" || Array.isArray(value)) throw new Error("Day或记录无效");
      const safe = { completed: value.completed === true };
      strings.forEach((field) => { safe[field] = typeof value[field] === "string" ? value[field].slice(0, 12000) : ""; });
      if (safe.evidenceType !== "W") safe.evidenceType = "M";
      for (const [field, max] of Object.entries({ k: 6, p1: 4, p2: 4, p3: 4, p4: 4, t: 4 })) {
        const n = value[field] === "" || value[field] == null ? "" : Number(value[field]);
        safe[field] = n !== "" && Number.isInteger(n) && n >= 0 && n <= max ? n : "";
      }
      if (safe.evidenceType === "M" && safe.t !== "" && safe.t > 2) safe.t = 2;
      result[key] = safe;
    }
    return result;
  }
  function status(message, error) {
    $("storage-status").textContent = message;
    $("storage-status").classList.toggle("error", !!error);
  }
  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ version: 1, records }));
      stored = true;
      status("已保存到本浏览器；更换设备或文件路径前请导出备份。");
    } catch (err) {
      stored = false;
      status("本地存储不可用：本次记录仅在当前页面内，请立即导出JSON备份。", true);
    }
  }
  function questionsHTML(a) {
    const questions = a.questions.map((q, i) => `<div class="question"><h4>题${i + 1} · 2分</h4><p>${esc(q.q)}</p>${q.options ? list(q.options, "options") : "<p class=\"muted\">写两项具体行动，每项一句。</p>"}</div>`).join("");
    const answers = a.questions.map((q, i) => `<p><b>${i + 1}.</b> ${esc(q.answer)} ${esc(q.reason || ("评分点：" + q.points.map((p) => p + "（1分）").join("；")))} ${q.options ? "正确2分，错误0分。" : "具体同义表达可得分。"}</p>`).join("");
    return questions + `<details class="answers"><summary>答题后展开答案与评分点 · 4分钟校准</summary>${answers}</details>`;
  }
  function rubricHTML(a) {
    return `<h4>表现评分 · 每维0—4分</h4><p>0分未演示或相反；1分只有口号或泛泛建议。4分必须在第二轮压力后演示。评分时记录原话和轮次。</p><div class="table-wrap"><table><thead><tr><th>维度</th><th>2分：初步结构</th><th>3分：独立完成</th><th>4分：压力下调整</th></tr></thead><tbody>${a.rubric.map((r) => `<tr><td>${esc(r.dim)}</td><td>${esc(r.a2)}</td><td>${esc(r.a3)}</td><td>${esc(r.a4)}</td></tr>`).join("")}</tbody></table></div>`;
  }
  function lessonHTML(d) {
    const a = d.assessment, s = d.steps;
    const knowledge = a ? `<p><b>3—11分钟：</b>先限时回答三题，题1、2各2分钟，题3用4分钟；不先看答案。</p>${questionsHTML(a)}<p><b>11—15分钟：</b>展开答案校准，再读本次判断边界：${esc(d.explanation)}</p>` :
      `<p><b>3—11分钟，核心精讲：</b>${esc(d.explanation)}</p><h4>三步操作卡</h4><ol>${s.map((step) => `<li>${esc(step)}。在本案写对应事实、对象或下一动作，不只抄步骤。</li>`).join("")}</ol><div class="callout"><b>误区：</b>${esc(d.pitfall)}。把原话改为一个具体观察、一个核实问题和一个有条件行动。</div><details class="method"><summary>微型示范：先复述，再核实条件</summary><p>面对“${esc(d.opening)}”，先复述对方担心，再问“在什么条件下你会认为方案可行？”潜在利益“${esc(d.hiddenInterest)}”仍需核实。随后用三步给出有边界的回应，具体取舍由你决定。</p></details><p><b>11—15分钟，自解释：</b>解释为什么先“${esc(s[0])}”再“${esc(s[1])}”；给一个反例，说明只交付成果为何不足以证明行为。</p>`;
    const source = d.sourceIds.length ? d.sourceIds.map((id) => {
      const src = data.sources[id - 1];
      return `<a href="${esc(src.url)}" target="_blank" rel="noopener">[${id}] ${esc(src.org)}</a>`;
    }).join(" · ") : "原创课程工具";
    const actionItems = a ? [
      "0—5分钟：按本日四维锚点给知识与表现评分，记录原话及发生轮次；综合分=K/6×20+P/16×60+T/4×20。",
      "5—13分钟：" + d.workAction + "。只查已归档的1—2条证据，标M模拟或W真实工作，按证据标准评分。",
      "13—18分钟：写主要差距及下一行动；未过门槛时在次日既定8分钟内重演最低维度，不加课。",
      "18—20分钟：归档答案、分数、证据和下一触发。Day200未过则标学习完成、能力待复核。"
    ] : [
      "0—5分钟：" + d.workAction + "。写“当____发生，我将____，以____为证据”，注明权限。",
      "5—13分钟：复盘一条已有脱敏工作原话/决定（W），或做8分钟桌面演练（M）。真实行动嵌入既有工作，不新增课程工时。",
      "13—18分钟：回答下面三个问题，每题1—2句，区分事实、解释和未验证假设。",
      "18—20分钟：归档成果、证据类型、下一触发和复核时间。到60分钟即停止。"
    ];
    let special = "";
    if (d.day === 1) special = `<div class="callout"><b>Day1基线：</b>在行动时段8分钟内重演自己的真实管理困境，保存初始原话。方向澄清、倾听核实、边界回应、行动闭环各自评0—4分，Day20用同一困境比较；不增加课时。</div>`;
    if ([50, 100, 150].includes(d.day)) special += `<div class="callout"><b>转段：</b>在5分钟反思内选一条前50天证据，将未解问题改写为下一责任半径的场景；不额外加课。</div>`;
    if (d.day === 200) special += `<div class="callout"><b>毕业验收：</b>汇总Day194—199已完成项目、200份日记录和10次测评。Day200须达门槛；真实工作迁移与模拟能力分别标注。</div>`;
    return `<div class="meta">${esc(d.phase)} · ${d.moduleId} ${esc(d.module)} · ${esc(d.level)}</div><h2 class="lesson-title" id="lesson-title">Day ${String(d.day).padStart(3, "0")} · ${esc(d.title)}</h2><div class="badges">${d.skills.map((v) => `<span class="badge">${esc(v)}</span>`).join("")}${a ? '<span class="badge assessment">阶段测评</span>' : ""}</div><p class="objective">${esc(d.objective)}</p>
      <section class="unit"><div class="unit-head"><h3>核心知识${a ? "与测题" : "精讲"}</h3><span class="minutes">15 min</span></div><p><b>0—3分钟，闭卷提取：</b>${esc(d.retrieval)}</p>${knowledge}</section>
      <section class="unit"><div class="unit-head"><h3>案例研讨与场景模拟</h3><span class="minutes">25 min</span></div><p><b>原创虚构情境：</b>${esc(d.case)}</p><p><b>角色：</b>你是负责人A，B是关键利益相关者，C观察。可独学口述并记原话，或两人/三人练习；均使用同一25分钟。正式测评每人须在自己的25分钟内主练。</p>
      <details class="method"><summary>B的角色卡 · A首轮开始前遮住</summary><p>开场：“${esc(d.opening)}”</p><p>隐藏利益：${esc(d.hiddenInterest)}。只在A合理提问后披露；遇到空泛承诺追问“具体由谁做，在什么条件下？”</p></details>
      <div class="table-wrap"><table><thead><tr><th>时间</th><th>逐轮脚本</th><th>成果</th></tr></thead><tbody>
      <tr><td class="script-time">0—3 min</td><td>看角色与案情，划出事实、权限、未知。独学先写B可能回应，不先替B确定利益。</td><td>一句共同问题</td></tr>
      <tr><td class="script-time">3—10 min</td><td>B：“${esc(d.opening)}” A依次：①${esc(s[0])}；②${esc(s[1])}；③${esc(s[2])}。</td><td>核实问题、取舍、行动</td></tr>
      <tr><td class="script-time">10—13 min</td><td>C或自己引用一句原话、一处遗漏、一个保留动作；不评人格。</td><td>保留1条、修改1条</td></tr>
      <tr><td class="script-time">13—20 min</td><td>B新增：“${esc(d.pressure)}” A说清因新信息调整什么、保留什么边界，再重演。</td><td>更新条件或权限</td></tr>
      <tr><td class="script-time">20—25 min</td><td>整理“${esc(d.artifact)}”：问题、三步动作、利益、压力调整、责任与复核，6—8条要点。</td><td>一页成果</td></tr></tbody></table></div>
      <details class="method"><summary>第一轮后展开：参考解题边界</summary><p>核实“${esc(d.hiddenInterest)}”；面对新增压力仍做到“${esc(s[1])}”，以“${esc(s[2])}”闭环。避免“${esc(d.pitfall)}”。可有多个合理方案，不能仅以对方立即同意为标准。</p><p>讨论：哪些约束不能由态度或权威解决？第二轮是否需要改变承诺？</p></details>
      <h4>当日行为核验</h4>${list(d.checklist, "checks")}${a ? rubricHTML(a) : ""}</section>
      <section class="unit"><div class="unit-head"><h3>${a ? "测评、证据与复盘" : "行动规划与反思"}</h3><span class="minutes">20 min</span></div>${list(actionItems)}<h4>三问反思</h4><ol>${d.reflectionQuestions.map((v) => `<li>${esc(v)}</li>`).join("")}</ol>${special}</section>
      <p class="source-note">方法参考：${source}。公开模型概述与原创教学改编；<a href="./08-方法来源与证据边界.md">查看来源边界</a>。本课程设计尚未完成效果验证。</p>`;
  }
  function renderList() {
    const query = $("search").value.trim().toLowerCase(), phase = $("phase-filter").value, skill = $("skill-filter").value, module = $("module-filter").value;
    const found = data.lessons.filter((d) => (!phase || d.phase === phase) && (!skill || d.skills.includes(skill)) && (!module || d.moduleId === module) && (!$("assessment-only").checked || d.assessment) && (!query || (String(d.day) + " " + d.title + " " + d.module + " " + d.explanation + " " + d.case + " " + d.skills.join(" ")).toLowerCase().includes(query)));
    $("result-count").textContent = `${found.length} / 200天`;
    $("day-list").innerHTML = found.length ? found.map((d) => `<button type="button" data-day="${d.day}" class="day-button${d.day === current ? " active" : ""}${records[d.day]?.completed ? " done" : ""}" aria-current="${d.day === current ? "true" : "false"}"><span class="daynum">DAY ${String(d.day).padStart(3, "0")}${d.assessment ? " · 测评" : ""}</span>${esc(d.title)}</button>`).join("") : '<div class="empty">无匹配课程，请调整关键词或筛选条件。</div>';
    const count = Object.values(records).filter((r) => r.completed).length;
    $("progress-count").textContent = `${count} / 200 天已记录`;
    $("progress-bar").value = count;
  }
  const fields = { date: "note-date", evidenceType: "evidence-type", artifact: "note-artifact", evidence: "note-evidence", action: "note-action", reflection: "note-reflection", grader: "grader", k: "score-k", p1: "score-p1", p2: "score-p2", p3: "score-p3", p4: "score-p4", t: "score-t" };
  function capture() {
    const record = {};
    for (const [key, id] of Object.entries(fields)) {
      record[key] = $("" + id).value;
      if (/^(k|t|p[1-4])$/.test(key) && record[key] !== "") record[key] = Number(record[key]);
    }
    record.completed = $("completed").checked;
    records[current] = validateRecords({ [current]: record })[current];
  }
  function loadRecord() {
    const record = records[current] || {};
    for (const [key, id] of Object.entries(fields)) {
      $(id).value = record[key] ?? (key === "evidenceType" ? "M" : key === "grader" ? "自评" : "");
    }
    $("completed").checked = !!record.completed;
    $("score-panel").hidden = !data.lessons[current - 1].assessment;
    const rubric = data.lessons[current - 1].assessment?.rubric;
    if (rubric) rubric.forEach((r, i) => { $("label-p" + (i + 1)).textContent = r.dim + "（0—4）"; });
    updateScore();
  }
  function updateScore() {
    const a = data.lessons[current - 1].assessment;
    if (!a) return;
    const maxT = $("evidence-type").value === "W" ? 4 : 2;
    $("score-t").max = maxT;
    if (+$("score-t").value > maxT) $("score-t").value = maxT;
    const inputs = ["score-k", "score-p1", "score-p2", "score-p3", "score-p4", "score-t"].map((id) => $(id));
    const valid = inputs.every((el) => el.value !== "" && Number.isInteger(+el.value) && +el.value >= 0 && +el.value <= +el.max);
    const threshold = current <= 40 ? 60 : current <= 140 ? 70 : 75;
    const floor = current <= 40 ? 1 : 2;
    if (!valid) {
      $("score-result").textContent = `填写六项原始分后计算。门槛≥${threshold}，四个表现维度均≥${floor}。M模拟迁移最高2分。`;
      return;
    }
    const k = +inputs[0].value, p = inputs.slice(1, 5).map((el) => +el.value), t = +inputs[5].value;
    const total = k / 6 * 20 + p.reduce((n, v) => n + v, 0) / 16 * 60 + t / 4 * 20;
    const pass = total >= threshold && p.every((v) => v >= floor);
    $("score-result").innerHTML = `<b>${total.toFixed(1)} / 100</b> · <span class="${pass ? "pass" : "fail"}">${pass ? "达到课程设计门槛" : "待复核"}</span> · ${esc($("grader").value || "自评")}<br><small>知识20% + 表现60% + 迁移20%。门槛${threshold}；每维≥${floor}。${$("evidence-type").value === "M" ? "模拟能力，不代表真实工作迁移。" : "W证据须按手册核验，不能仅凭自述认定。"}</small>`;
  }
  function stopTimer() {
    if (running) remaining = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
    running = false;
    clearInterval(interval);
    interval = null;
    $("timer-start").textContent = "开始";
  }
  function paintTimer() {
    $("clock").textContent = String(Math.floor(remaining / 60)).padStart(2, "0") + ":" + String(remaining % 60).padStart(2, "0");
    $("timer-label").textContent = segments[segment].label + " · " + segments[segment].minutes + "分钟";
    document.querySelectorAll("[data-segment]").forEach((btn) => btn.setAttribute("aria-pressed", String(+btn.dataset.segment === segment)));
  }
  function resetTimer() { stopTimer(); remaining = segments[segment].minutes * 60; paintTimer(); }
  function selectDay(day, scroll) {
    if (initialized) {
      clearTimeout(saveDebounce);
      updateScore(); capture(); persist();
    }
    current = Math.max(1, Math.min(200, day));
    segment = 0;
    resetTimer();
    $("lesson").innerHTML = lessonHTML(data.lessons[current - 1]);
    $("note-heading").textContent = `Day ${String(current).padStart(3, "0")} · 行动与反思记录`;
    $("prev-day").disabled = current === 1;
    $("next-day").disabled = current === 200;
    $("book-link").href = "./" + data.books[Math.floor((current - 1) / 20)].name;
    $("book-link").textContent = "打开本日完整教材";
    loadRecord(); renderList(); initialized = true;
    try { history.replaceState(null, "", "#day-" + current); } catch (err) { /* file browser may reject */ }
    if (scroll) $("lesson-title").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  $("day-list").addEventListener("click", (event) => {
    const btn = event.target.closest("[data-day]");
    if (btn) selectDay(+btn.dataset.day, true);
  });
  ["search", "phase-filter", "skill-filter", "module-filter", "assessment-only"].forEach((id) => $(id).addEventListener(id === "search" ? "input" : "change", renderList));
  $("clear-filters").addEventListener("click", () => { $("search").value = ""; $("phase-filter").value = ""; $("skill-filter").value = ""; $("module-filter").value = ""; $("assessment-only").checked = false; renderList(); });
  $("phase-filter").innerHTML += data.phases.map((p) => `<option value="${esc(p)}">${esc(p)}</option>`).join("");
  $("skill-filter").innerHTML += [...new Set(data.modules.flatMap((m) => m.skills))].map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join("");
  $("module-filter").innerHTML += data.modules.map((m, i) => `<option value="M${String(i + 1).padStart(2, "0")}">M${String(i + 1).padStart(2, "0")} ${esc(m.name)}</option>`).join("");
  $("prev-day").addEventListener("click", () => selectDay(current - 1, true));
  $("next-day").addEventListener("click", () => selectDay(current + 1, true));
  document.querySelectorAll("[data-segment]").forEach((btn) => btn.addEventListener("click", () => { segment = +btn.dataset.segment; resetTimer(); $("timer-message").textContent = "已切换时段；到点停止并进入下一段。切换会重置本段计时。"; }));
  $("timer-start").addEventListener("click", () => {
    if (running) { stopTimer(); paintTimer(); return; }
    if (remaining <= 0) remaining = segments[segment].minutes * 60;
    running = true;
    endAt = Date.now() + remaining * 1000;
    $("timer-start").textContent = "暂停";
    $("timer-message").textContent = "计时进行中。记录实际完成情况；工具计时不自动认定学习完成。";
    interval = setInterval(() => {
      remaining = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      paintTimer();
      if (remaining === 0) {
        stopTimer();
        $("timer-message").textContent = segments[segment].label + "时段已结束。到点停止，选择下一时段；未解问题写入观察记录。";
      }
    }, 250);
  });
  $("timer-reset").addEventListener("click", resetTimer);
  $("save-note").addEventListener("click", () => { updateScore(); capture(); persist(); renderList(); });
  let saveDebounce;
  $("note-form").addEventListener("input", () => { updateScore(); clearTimeout(saveDebounce); saveDebounce = setTimeout(() => { capture(); persist(); renderList(); }, 500); });
  $("note-form").addEventListener("change", () => { updateScore(); capture(); persist(); renderList(); });
  $("export-notes").addEventListener("click", () => {
    updateScore(); capture(); persist();
    const blob = new Blob([JSON.stringify({ version: 1, courseVersion: data.version, exportedAt: new Date().toISOString(), records }, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob), anchor = document.createElement("a");
    anchor.href = url; anchor.download = "MBA-EMBA-200天学习记录-" + new Date().toISOString().slice(0, 10) + ".json";
    anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    status(stored ? "已生成JSON备份；请确认文件已下载。" : "已生成JSON备份；本地存储不可用，请确认下载。", !stored);
  });
  $("import-notes").addEventListener("click", async () => {
    const file = $("import-file").files[0];
    if (!file) { status("请先选择课程导出的JSON文件。", true); return; }
    if (file.size > 8 * 1024 * 1024) { status("文件过大，请选择本课程的学习记录JSON。", true); return; }
    try {
      const payload = JSON.parse(await file.text());
      if (payload.version !== 1 || !payload.records) throw new Error("版本或记录格式无效");
      const incoming = validateRecords(payload.records);
      const overlaps = Object.keys(incoming).filter((key) => records[key]);
      if (overlaps.length && !window.confirm(`导入将覆盖本机${overlaps.length}天的同日记录。建议先导出备份；是否继续？`)) return;
      records = Object.assign({}, records, incoming);
      persist(); loadRecord(); renderList();
      status(stored ? `已合并${Object.keys(incoming).length}天记录并保存到本机。` : "已合并到当前页面；存储不可用，请立即导出。", !stored);
    } catch (err) { status("导入失败：" + err.message + "。原有记录未改动。", true); }
  });
  $("clear-day").addEventListener("click", () => {
    if (!window.confirm(`清除Day ${current}本机记录？建议先导出备份。`)) return;
    delete records[current]; persist(); loadRecord(); renderList();
  });
  $("print-day").addEventListener("click", () => {
    const details = [...$("lesson").querySelectorAll("details")], original = details.map((d) => d.open);
    details.forEach((d) => { d.open = true; });
    const restore = () => { details.forEach((d, i) => { d.open = original[i]; }); window.removeEventListener("afterprint", restore); };
    window.addEventListener("afterprint", restore); window.print();
  });
  window.addEventListener("beforeunload", () => { clearTimeout(saveDebounce); capture(); persist(); });
  const hashDay = /^#day-(\d+)$/.exec(location.hash);
  selectDay(hashDay ? +hashDay[1] : 1, false);
  paintTimer();
  status(stored ? "记录仅存本浏览器；每20天请导出一次JSON备份。" : "本地存储不可用：记录仅在当前页面内，请导出JSON或使用纸笔。", !stored);
  if (window.echarts && $("phase-chart")) {
    const chart = echarts.init($("phase-chart"));
    chart.setOption({
      animation: false,
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, formatter: (params) => esc(params[0].name) + "：50小时（课程设定）" },
      grid: { left: 82, right: 42, top: 12, bottom: 20 },
      xAxis: { type: "value", max: 60, interval: 20, axisLabel: { color: "#59666e", fontSize: 11 }, splitLine: { lineStyle: { color: "#d9dfdd" } } },
      yAxis: { type: "category", inverse: true, data: data.phases, axisLabel: { color: "#172b35", fontSize: 12 }, axisLine: { show: false }, axisTick: { show: false } },
      series: [{ type: "bar", data: [50, 50, 50, 50], barWidth: 24, itemStyle: { color: "#146353", borderRadius: [0, 4, 4, 0] }, label: { show: true, position: "right", formatter: "50h", color: "#146353" } }]
    });
    window.addEventListener("resize", () => chart.resize());
    $("overview").addEventListener("toggle", () => chart.resize());
  }
})();
