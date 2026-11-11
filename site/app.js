(() => {
  if (!window.STREET_DATA || !document.querySelector("#street-explorer")) return;

  const categories = [
    "phonetic_transliteration",
    "semantic_translation",
    "hybrid_phonetic_semantic",
    "conventional_or_indirect",
  ];
  const scoreBands = ["0-.24", ".25-.49", ".50-.74", ".75-1.00"];
  const categoryColors = {
    phonetic_transliteration: "#0c5c4b",
    semantic_translation: "#b94d34",
    hybrid_phonetic_semantic: "#bd8a34",
    conventional_or_indirect: "#6f7d87",
  };
  const activeSimulations = [];

  const elements = {
    search: document.querySelector("#corpus-search"),
    categoryButtons: [...document.querySelectorAll("[data-category-filter]")],
    checked: document.querySelector("#checked-filter"),
    roadType: document.querySelector("#road-type-filter"),
    scoreBand: document.querySelector("#score-filter"),
    reset: document.querySelector("#reset-filters"),
    resultCount: document.querySelector("#result-count"),
    activeFilters: document.querySelector("#active-filters"),
    networkFrame: document.querySelector("#network-chart"),
    networkSummary: document.querySelector("#network-summary"),
    networkTerms: document.querySelector("#network-terms"),
    networkTermsValue: document.querySelector("#network-terms-value"),
    networkMin: document.querySelector("#network-min"),
    networkMinValue: document.querySelector("#network-min-value"),
    treemapFrame: document.querySelector("#treemap-chart"),
    heatmapFrame: document.querySelector("#heatmap-chart"),
    tableBody: document.querySelector("#corpus-rows"),
    tableHeaders: [...document.querySelectorAll("[data-sort]")],
    showRows: document.querySelector("#show-rows"),
    exportCsv: document.querySelector("#export-csv"),
  };

  const state = {
    q: "",
    category: "all",
    checked: "all",
    roadType: "all",
    scoreBand: "all",
    sort: "id",
    direction: "asc",
    show: 25,
    topTerms: 14,
    minLink: 1,
  };

  function t(key, values) {
    return window.APP_I18N.t(key, values);
  }

  function language() {
    return window.APP_I18N.language;
  }

  function categoryLabel(value) {
    return t(`categories.${value}`);
  }

  function normalize(value) {
    return String(value ?? "")
      .normalize("NFKC")
      .toLocaleLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function parseUrlState() {
    const params = new URLSearchParams(window.location.search);
    const category = params.get("category");
    const checked = params.get("checked");
    const roadType = params.get("type");
    const scoreBand = params.get("score");
    const sort = params.get("sort");
    const direction = params.get("dir");
    const show = Number(params.get("show"));

    state.q = params.get("q") || "";
    state.category = category === "all" || categories.includes(category)
      ? category
      : "all";
    state.checked = ["yes", "no"].includes(checked) ? checked : "all";
    state.roadType = roadType || "all";
    state.scoreBand = scoreBands.includes(scoreBand) ? scoreBand : "all";
    state.sort = sort || "id";
    state.direction = direction === "desc" ? "desc" : "asc";
    state.show = [25, 50, 100, 500].includes(show) ? show : 25;
  }

  function writeUrlState() {
    const url = new URL(window.location.href);
    const values = {
      q: state.q,
      category: state.category,
      checked: state.checked,
      type: state.roadType,
      score: state.scoreBand,
      sort: state.sort === "id" ? "" : state.sort,
      dir: state.direction === "asc" ? "" : state.direction,
      show: state.show === 25 ? "" : String(state.show),
    };
    Object.entries(values).forEach(([key, value]) => {
      if (!value || value === "all") {
        url.searchParams.delete(key);
      } else {
        url.searchParams.set(key, value);
      }
    });
    window.history.replaceState({}, "", url);
  }

  function syncControls() {
    elements.search.value = state.q;
    elements.checked.value = state.checked;
    elements.roadType.value = state.roadType;
    elements.scoreBand.value = state.scoreBand;
    elements.showRows.value = String(state.show);
    elements.networkTerms.value = String(state.topTerms);
    elements.networkMin.value = String(state.minLink);
    elements.networkTermsValue.textContent = String(state.topTerms);
    elements.networkMinValue.textContent = String(state.minLink);
    elements.categoryButtons.forEach((button) => {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.categoryFilter === state.category),
      );
    });
  }

  function passesFilters(row, ignored = "") {
    if (state.q) {
      const haystack = normalize(
        [
          row.id,
          row.sourceText,
          row.targetText,
          row.keyTerm,
          row.category,
          row.semanticEvidence,
        ].join(" "),
      );
      if (!haystack.includes(normalize(state.q))) return false;
    }
    if (ignored !== "category" && state.category !== "all" && row.category !== state.category) {
      return false;
    }
    if (ignored !== "checked" && state.checked !== "all" && row.humanChecked !== state.checked) {
      return false;
    }
    if (ignored !== "roadType" && state.roadType !== "all" && row.roadType !== state.roadType) {
      return false;
    }
    if (ignored !== "scoreBand" && state.scoreBand !== "all" && row.scoreBand !== state.scoreBand) {
      return false;
    }
    return true;
  }

  function filteredRows(ignored = "") {
    return window.STREET_DATA.filter((row) => passesFilters(row, ignored));
  }

  function setState(changes) {
    Object.assign(state, changes);
    syncControls();
    writeUrlState();
    renderAll();
  }

  function updateResultSummary(rows) {
    elements.resultCount.innerHTML = `<span>${rows.length}</span> ${
      rows.length === 1 ? t("resultOne") : t("resultMany")
    }`;

    const active = [];
    if (state.q) active.push(t("searchActive", { value: state.q }));
    if (state.category !== "all") active.push(categoryLabel(state.category));
    if (state.checked !== "all") active.push(t(`checked.${state.checked}`));
    if (state.roadType !== "all") active.push(state.roadType);
    if (state.scoreBand !== "all") active.push(t("scoreBand", { value: state.scoreBand }));
    elements.activeFilters.textContent =
      active.length > 0 ? `${t("active")} ${active.join(" · ")}` : "";
  }

  function updateCategoryCounts() {
    const rows = filteredRows("category");
    elements.categoryButtons.forEach((button) => {
      const category = button.dataset.categoryFilter;
      const count = category === "all"
        ? rows.length
        : rows.filter((row) => row.category === category).length;
      const countNode = button.querySelector("[data-count]");
      if (countNode) countNode.textContent = String(count);
    });
  }

  function emptyState(container) {
    container.innerHTML = `<div class="empty-state">${t("noData")}</div>`;
  }

  function stopSimulations() {
    while (activeSimulations.length) {
      activeSimulations.pop().stop();
    }
  }

  function renderNetwork(rows) {
    stopSimulations();
    const host = elements.networkFrame;
    host.innerHTML = "";
    if (!rows.length) {
      emptyState(host);
      elements.networkSummary.textContent = t("noData");
      return;
    }

    const termCounts = new Map();
    const characterCounts = new Map();
    rows.forEach((row) => {
      row.keyTerms.forEach((term) => {
        termCounts.set(term, (termCounts.get(term) || 0) + 1);
      });
      row.characters.forEach((character) => {
        characterCounts.set(character, (characterCounts.get(character) || 0) + 1);
      });
    });

    const topTerms = [...termCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, state.topTerms);
    const selectedTerms = new Set(topTerms.map(([term]) => term));
    const topCharacters = [...characterCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, Math.max(18, Math.round(state.topTerms * 1.65)));
    const selectedCharacters = new Set(
      topCharacters.map(([character]) => character),
    );

    const linkCounts = new Map();
    rows.forEach((row) => {
      const terms = row.keyTerms.filter((term) => selectedTerms.has(term));
      terms.forEach((term) => {
        row.characters
          .filter((character) => selectedCharacters.has(character))
          .forEach((character) => {
          const key = `${term}\t${character}`;
          linkCounts.set(key, (linkCounts.get(key) || 0) + 1);
          });
      });
    });

    const links = [...linkCounts.entries()]
      .filter(([, value]) => value >= state.minLink)
      .map(([key, value]) => {
        const [source, target] = key.split("\t");
        return { source: `e:${source}`, target: `c:${target}`, value };
      });
    const linkedTerms = new Set(links.map((link) => link.source.slice(2)));
    const linkedCharacters = new Set(links.map((link) => link.target.slice(2)));

    const nodes = [
      ...topTerms
        .filter(([term]) => linkedTerms.has(term))
        .map(([term, count]) => ({
          id: `e:${term}`,
          label: term,
          count,
          type: "english",
        })),
      ...topCharacters
        .filter(([character]) => linkedCharacters.has(character))
        .map(([character, count]) => ({
          id: `c:${character}`,
          label: character,
          count,
          type: "chinese",
        })),
    ];

    if (!nodes.length) {
      emptyState(host);
      elements.networkSummary.textContent = t("noData");
      return;
    }

    const width = Math.max(host.clientWidth, 300);
    const height = width < 560 ? 350 : 430;
    const svg = d3
      .select(host)
      .append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("role", "img")
      .attr("aria-label", "Network of English name elements and Chinese characters");
    const graph = svg.append("g");
    const zoom = d3
      .zoom()
      .scaleExtent([0.65, 3])
      .on("zoom", (event) => graph.attr("transform", event.transform));
    svg.call(zoom);

    const simulation = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3
          .forceLink(links)
          .id((node) => node.id)
          .distance((link) => 72 + 45 / Math.sqrt(link.value))
          .strength(0.45),
      )
      .force("charge", d3.forceManyBody().strength(-145))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius((node) => nodeRadius(node) + 8))
      .on("tick", () => {
        nodes.forEach((item) => {
          const horizontalMargin = item.type === "english" ? 62 : 18;
          item.x = Math.max(horizontalMargin, Math.min(width - horizontalMargin, item.x));
          item.y = Math.max(26, Math.min(height - 18, item.y));
        });
        link
          .attr("x1", (item) => item.source.x)
          .attr("y1", (item) => item.source.y)
          .attr("x2", (item) => item.target.x)
          .attr("y2", (item) => item.target.y);
        node.attr("transform", (item) => `translate(${item.x},${item.y})`);
      });
    activeSimulations.push(simulation);

    const link = graph
      .append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("class", "network-link")
      .attr("stroke-width", (item) => 0.7 + Math.min(3, Math.sqrt(item.value)));

    const node = graph
      .append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("class", "network-node")
      .attr("role", "button")
      .attr("tabindex", 0)
      .attr("aria-label", (item) => `${item.label}: ${item.count}. ${t("enter")}`)
      .on("click", (_, item) => setState({ q: item.label }))
      .on("keydown", (event, item) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setState({ q: item.label });
        }
      })
      .call(
        d3
          .drag()
          .on("start", (event, item) => {
            if (!event.active) simulation.alphaTarget(0.22).restart();
            item.fx = item.x;
            item.fy = item.y;
          })
          .on("drag", (event, item) => {
            item.fx = event.x;
            item.fy = event.y;
          })
          .on("end", (event, item) => {
            if (!event.active) simulation.alphaTarget(0);
            item.fx = null;
            item.fy = null;
          }),
      );

    node
      .append("circle")
      .attr("r", nodeRadius)
      .attr("fill", (item) =>
        item.type === "chinese" ? "#b94d34" : "#0c5c4b",
      )
      .attr("stroke", "#fffdf7")
      .attr("stroke-width", 1.5);

    node
      .filter((item) => item.type === "chinese")
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("fill", "#fffdf7")
      .attr("font-family", '"Noto Serif TC", serif')
      .attr("font-size", (item) => Math.max(9, nodeRadius(item) * 0.85))
      .text((item) => item.label);

    node
      .filter((item) => item.type === "english")
      .append("text")
      .attr("class", "network-label")
      .attr("text-anchor", (item) => (item.x > width * 0.7 ? "end" : "start"))
      .attr("x", (item) =>
        item.x > width * 0.7 ? -(nodeRadius(item) + 4) : nodeRadius(item) + 4,
      )
      .attr("y", 3)
      .text((item) => item.label);

    node
      .append("title")
      .text((item) => `${item.label}: ${item.count}`);

    elements.networkSummary.textContent = t("networkSummary", {
      terms: nodes.filter((item) => item.type === "english").length,
      chars: nodes.filter((item) => item.type === "chinese").length,
      links: links.length,
    });
  }

  function nodeRadius(node) {
    return Math.max(5, Math.min(15, 4 + Math.sqrt(node.count) * 1.8));
  }

  function renderTreemap(rows) {
    const host = elements.treemapFrame;
    host.innerHTML = "";
    if (!rows.length) {
      emptyState(host);
      return;
    }

    const grouped = new Map();
    rows.forEach((row) => {
      if (!grouped.has(row.category)) grouped.set(row.category, new Map());
      const leaves = grouped.get(row.category);
      leaves.set(row.roadType, (leaves.get(row.roadType) || 0) + 1);
    });
    const rootData = {
      name: t("chartRoot"),
      children: [...grouped.entries()].map(([category, leaves]) => ({
        name: category,
        children: [...leaves.entries()].map(([roadType, value]) => ({
          name: roadType,
          roadType,
          category,
          value,
        })),
      })),
    };
    const root = d3
      .hierarchy(rootData)
      .sum((item) => item.value || 0)
      .sort((a, b) => b.value - a.value);
    const width = Math.max(host.clientWidth, 280);
    const height = width < 500 ? 300 : 340;
    d3.treemap().size([width, height]).paddingInner(2).paddingOuter(1).round(true)(root);

    const svg = d3
      .select(host)
      .append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("role", "img")
      .attr("aria-label", "Treemap of translation categories and road types");
    const groups = svg
      .selectAll("g")
      .data(root.children)
      .join("g");

    groups
      .append("rect")
      .attr("x", (item) => item.x0)
      .attr("y", (item) => item.y0)
      .attr("width", (item) => item.x1 - item.x0)
      .attr("height", (item) => item.y1 - item.y0)
      .attr("fill", (item) => categoryColors[item.data.name])
      .attr("fill-opacity", 0.18)
      .attr("class", "treemap-category");

    groups
      .append("text")
      .attr("class", "treemap-parent-label")
      .attr("x", (item) => item.x0 + 4)
      .attr("y", (item) => item.y0 + 12)
      .text((item) => categoryLabel(item.data.name));

    const leaves = groups
      .selectAll("g")
      .data((item) => item.leaves())
      .join("g");

    leaves
      .append("rect")
      .attr("class", "treemap-leaf")
      .attr("x", (item) => item.x0)
      .attr("y", (item) => item.y0)
      .attr("width", (item) => Math.max(0, item.x1 - item.x0))
      .attr("height", (item) => Math.max(0, item.y1 - item.y0))
      .attr("fill", (item) => categoryColors[item.data.category])
      .attr("fill-opacity", 0.83)
      .attr("role", "button")
      .attr("tabindex", 0)
      .attr("aria-label", (item) =>
        `${categoryLabel(item.data.category)}, ${item.data.roadType}: ${item.value}`,
      )
      .on("click", (_, item) =>
        setState({ category: item.data.category, roadType: item.data.roadType }),
      )
      .on("keydown", (event, item) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setState({ category: item.data.category, roadType: item.data.roadType });
        }
      });

    leaves
      .filter((item) => item.x1 - item.x0 > 54 && item.y1 - item.y0 > 24)
      .append("text")
      .attr("class", "treemap-label")
      .attr("x", (item) => item.x0 + 4)
      .attr("y", (item) => item.y0 + 13)
      .text((item) => `${item.data.roadType} ${item.value}`);

    leaves.append("title").text((item) =>
      `${categoryLabel(item.data.category)} / ${item.data.roadType}: ${item.value}`,
    );
  }

  function renderHeatmap(rows) {
    const host = elements.heatmapFrame;
    host.innerHTML = "";
    if (!rows.length) {
      emptyState(host);
      return;
    }

    const counts = new Map();
    rows.forEach((row) => {
      const key = `${row.category}\t${row.scoreBand}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    const maxCount = Math.max(1, ...counts.values());
    const width = Math.max(host.clientWidth, 280);
    const height = width < 500 ? 300 : 300;
    const margin = { top: 34, right: 8, bottom: 16, left: 126 };
    const cellWidth = (width - margin.left - margin.right) / scoreBands.length;
    const cellHeight = (height - margin.top - margin.bottom) / categories.length;
    const svg = d3
      .select(host)
      .append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("role", "img")
      .attr("aria-label", "Heatmap of phonetic score bands by translation category");
    const color = d3
      .scaleSequential()
      .domain([0, maxCount])
      .interpolator(d3.interpolateRgb("#edf2ee", "#0c5c4b"));

    svg
      .append("g")
      .selectAll("text")
      .data(scoreBands)
      .join("text")
      .attr("class", "heat-axis")
      .attr("text-anchor", "middle")
      .attr("x", (_, index) => margin.left + cellWidth * (index + 0.5))
      .attr("y", margin.top - 10)
      .text((item) => item);

    svg
      .append("g")
      .selectAll("text")
      .data(categories)
      .join("text")
      .attr("class", "heat-label")
      .attr("text-anchor", "end")
      .attr("x", margin.left - 8)
      .attr("y", (_, index) => margin.top + cellHeight * (index + 0.5) + 3)
      .text(categoryLabel);

    const cells = [];
    categories.forEach((category, rowIndex) => {
      scoreBands.forEach((band, columnIndex) => {
        cells.push({
          category,
          band,
          value: counts.get(`${category}\t${band}`) || 0,
          rowIndex,
          columnIndex,
        });
      });
    });

    svg
      .append("g")
      .selectAll("rect")
      .data(cells)
      .join("rect")
      .attr("class", (item) =>
        `heat-cell ${
          state.category === item.category && state.scoreBand === item.band
            ? "is-active"
            : ""
        }`,
      )
      .attr("x", (item) => margin.left + item.columnIndex * cellWidth)
      .attr("y", (item) => margin.top + item.rowIndex * cellHeight)
      .attr("width", Math.max(1, cellWidth - 2))
      .attr("height", Math.max(1, cellHeight - 2))
      .attr("fill", (item) => item.value ? color(item.value) : "#e5dfd3")
      .attr("role", "button")
      .attr("tabindex", 0)
      .attr("aria-label", (item) =>
        `${categoryLabel(item.category)}, ${item.band}: ${item.value}`,
      )
      .on("click", (_, item) => {
        const selected =
          state.category === item.category && state.scoreBand === item.band;
        setState({
          category: selected ? "all" : item.category,
          scoreBand: selected ? "all" : item.band,
        });
      })
      .on("keydown", (event, item) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          const selected =
            state.category === item.category && state.scoreBand === item.band;
          setState({
            category: selected ? "all" : item.category,
            scoreBand: selected ? "all" : item.band,
          });
        }
      })
      .append("title")
      .text((item) =>
        `${categoryLabel(item.category)} / ${item.band}: ${item.value}`,
      );

    svg
      .append("g")
      .selectAll("text")
      .data(cells)
      .join("text")
      .attr("class", "heat-value")
      .attr("text-anchor", "middle")
      .attr("pointer-events", "none")
      .attr("x", (item) => margin.left + cellWidth * (item.columnIndex + 0.5))
      .attr("y", (item) => margin.top + cellHeight * (item.rowIndex + 0.5) + 3)
      .attr("fill", (item) =>
        item.value / maxCount > 0.56 ? "#fffdf7" : "#17251f",
      )
      .text((item) => item.value || "");
  }

  function sortRows(rows) {
    const direction = state.direction === "desc" ? -1 : 1;
    return [...rows].sort((a, b) => {
      const left = a[state.sort];
      const right = b[state.sort];
      if (typeof left === "number" && typeof right === "number") {
        return (left - right) * direction;
      }
      return String(left).localeCompare(String(right), language() === "zh" ? "zh-Hant" : "en", {
        numeric: true,
      }) * direction;
    });
  }

  function renderTable(rows) {
    const sorted = sortRows(rows);
    const visible = sorted.slice(0, state.show);
    elements.tableBody.innerHTML = "";
    if (!visible.length) {
      elements.tableBody.innerHTML = `<tr><td colspan="6" class="no-results">${t(
        "noData",
      )}</td></tr>`;
    } else {
      const fragment = document.createDocumentFragment();
      visible.forEach((row) => {
        const tr = document.createElement("tr");
        const category = document.createElement("span");
        category.className = `category-pill ${row.category}`;
        category.textContent = categoryLabel(row.category);

        const checked = document.createElement("span");
        checked.className = "check-pill";
        checked.textContent = t(`checked.${row.humanChecked}`);

        tr.innerHTML = `
          <td class="cell-id">${row.id}</td>
          <td class="pair-cell">
            <strong></strong>
            <span></span>
          </td>
          <td class="category-cell"></td>
          <td class="score-cell">
            <span class="tabular-nums">${row.phoneticScore.toFixed(3)}</span>
            <div class="score-track"><div class="score-fill" style="width:${
              row.phoneticScore * 100
            }%"></div></div>
          </td>
          <td>${row.roadType}</td>
          <td class="check-cell"></td>
        `;
        tr.querySelector(".pair-cell strong").textContent = row.targetText;
        tr.querySelector(".pair-cell span").textContent = row.sourceText;
        tr.querySelector(".category-cell").append(category);
        tr.querySelector(".check-cell").append(checked);
        fragment.append(tr);
      });
      elements.tableBody.append(fragment);
    }

    elements.tableHeaders.forEach((button) => {
      const header = button.closest("th");
      if (button.dataset.sort === state.sort) {
        header.setAttribute(
          "aria-sort",
          state.direction === "asc" ? "ascending" : "descending",
        );
      } else {
        header.removeAttribute("aria-sort");
      }
    });
  }

  function renderAll() {
    const rows = filteredRows();
    updateResultSummary(rows);
    updateCategoryCounts();
    renderNetwork(rows);
    renderTreemap(rows);
    renderHeatmap(rows);
    renderTable(rows);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("q", state.q);
      url.searchParams.set("category", state.category);
      url.searchParams.set("checked", state.checked);
      url.searchParams.set("type", state.roadType);
      url.searchParams.set("score", state.scoreBand);
      url.searchParams.set("lang", language());
    } catch {
      // URL state is an enhancement; rendering remains functional without it.
    }
  }

  function csvEscape(value) {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function exportFilteredCsv() {
    const rows = sortRows(filteredRows());
    const columns = [
      ["id", "id"],
      ["source_text", "sourceText"],
      ["target_text", "targetText"],
      ["source", "source"],
      ["category", "category"],
      ["human_checked", "humanChecked"],
      ["unit", "unit"],
      ["key_term", "keyTerm"],
      ["street_code", "streetCode"],
      ["object_id", "objectId"],
      ["segment_count", "segmentCount"],
      ["phonetic_score", "phoneticScore"],
      ["semantic_evidence", "semanticEvidence"],
      ["road_type", "roadType"],
    ];
    const lines = [
      columns.map(([header]) => header).join(","),
      ...rows.map((row) =>
        columns.map(([, key]) => csvEscape(row[key])).join(","),
      ),
    ];
    const blob = new Blob([`\ufeff${lines.join("\r\n")}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "hong_kong_street_names_filtered.csv";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function populateRoadTypes() {
    const values = [...new Set(window.STREET_DATA.map((row) => row.roadType))]
      .sort((a, b) => a.localeCompare(b));
    values.forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      elements.roadType.append(option);
    });
  }

  function bindEvents() {
    elements.search.addEventListener("input", (event) => {
      state.q = event.target.value.trim();
      writeUrlState();
      renderAll();
    });
    elements.checked.addEventListener("change", (event) => {
      setState({ checked: event.target.value });
    });
    elements.roadType.addEventListener("change", (event) => {
      setState({ roadType: event.target.value });
    });
    elements.scoreBand.addEventListener("change", (event) => {
      setState({ scoreBand: event.target.value });
    });
    elements.categoryButtons.forEach((button) => {
      button.addEventListener("click", () => {
        setState({ category: button.dataset.categoryFilter });
      });
    });
    elements.reset.addEventListener("click", () => {
      setState({
        q: "",
        category: "all",
        checked: "all",
        roadType: "all",
        scoreBand: "all",
      });
    });
    elements.networkTerms.addEventListener("input", (event) => {
      state.topTerms = Number(event.target.value);
      elements.networkTermsValue.textContent = String(state.topTerms);
      renderNetwork(filteredRows());
    });
    elements.networkMin.addEventListener("input", (event) => {
      state.minLink = Number(event.target.value);
      elements.networkMinValue.textContent = String(state.minLink);
      renderNetwork(filteredRows());
    });
    elements.tableHeaders.forEach((button) => {
      button.addEventListener("click", () => {
        const field = button.dataset.sort;
        if (state.sort === field) {
          state.direction = state.direction === "asc" ? "desc" : "asc";
        } else {
          state.sort = field;
          state.direction = "asc";
        }
        writeUrlState();
        renderTable(filteredRows());
      });
    });
    elements.showRows.addEventListener("change", (event) => {
      state.show = Number(event.target.value);
      writeUrlState();
      renderTable(filteredRows());
    });
    elements.exportCsv.addEventListener("click", exportFilteredCsv);
    document.addEventListener("app:language", () => {
      syncControls();
      renderAll();
    });
    window.addEventListener("popstate", () => {
      parseUrlState();
      syncControls();
      renderAll();
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    parseUrlState();
    populateRoadTypes();
    syncControls();
    bindEvents();
    renderAll();
  });
})();
