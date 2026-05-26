const MAX_COMPARISONS = 5;
const MARK_CLASSES = ["mark-red", "mark-underline", "mark-yellow", "mark-bold", "mark-italic"];
const DEFAULT_COMPARISONS = ["GCTA"];

const els = {
  mainSequence: document.querySelector("#mainSequence"),
  comparisonList: document.querySelector("#comparisonList"),
  addComparisonButton: document.querySelector("#addComparisonButton"),
  matchScore: document.querySelector("#matchScore"),
  mismatchScore: document.querySelector("#mismatchScore"),
  gapScore: document.querySelector("#gapScore"),
  alignButton: document.querySelector("#alignButton"),
  exportWordButton: document.querySelector("#exportWordButton"),
  board: document.querySelector("#alignmentBoard"),
  scoreValue: document.querySelector("#scoreValue"),
  mainLength: document.querySelector("#mainLength"),
  comparisonCount: document.querySelector("#comparisonCount"),
  differenceCount: document.querySelector("#differenceCount"),
  identityRate: document.querySelector("#identityRate"),
};

function cleanSequence(value) {
  return value.toUpperCase().replace(/[^A-Z*-]/g, "").replace(/\*/g, "-");
}

function numberValue(input, fallback) {
  const value = Number(input.value);
  return Number.isFinite(value) ? value : fallback;
}

function scores() {
  return {
    match: numberValue(els.matchScore, 2),
    mismatch: numberValue(els.mismatchScore, -1),
    gap: numberValue(els.gapScore, -2),
  };
}

function alignSequences(seqA, seqB, scoreValues) {
  const rows = seqA.length + 1;
  const cols = seqB.length + 1;
  const matrix = Array.from({ length: rows }, () => Array(cols).fill(0));
  const trace = Array.from({ length: rows }, () => Array(cols).fill(""));

  for (let i = 1; i < rows; i += 1) {
    matrix[i][0] = matrix[i - 1][0] + scoreValues.gap;
    trace[i][0] = "up";
  }

  for (let j = 1; j < cols; j += 1) {
    matrix[0][j] = matrix[0][j - 1] + scoreValues.gap;
    trace[0][j] = "left";
  }

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const diagonal =
        matrix[i - 1][j - 1] +
        (seqA[i - 1] === seqB[j - 1] ? scoreValues.match : scoreValues.mismatch);
      const up = matrix[i - 1][j] + scoreValues.gap;
      const left = matrix[i][j - 1] + scoreValues.gap;
      const best = Math.max(diagonal, up, left);

      matrix[i][j] = best;
      trace[i][j] = best === diagonal ? "diagonal" : best === up ? "up" : "left";
    }
  }

  let alignedA = "";
  let alignedB = "";
  let i = seqA.length;
  let j = seqB.length;

  while (i > 0 || j > 0) {
    const direction = trace[i][j];

    if (i > 0 && j > 0 && direction === "diagonal") {
      alignedA = seqA[i - 1] + alignedA;
      alignedB = seqB[j - 1] + alignedB;
      i -= 1;
      j -= 1;
    } else if (i > 0 && (direction === "up" || j === 0)) {
      alignedA = seqA[i - 1] + alignedA;
      alignedB = "-" + alignedB;
      i -= 1;
    } else {
      alignedA = "-" + alignedA;
      alignedB = seqB[j - 1] + alignedB;
      j -= 1;
    }
  }

  return {
    alignedMain: alignedA,
    alignedComparison: alignedB,
    score: matrix[seqA.length][seqB.length],
  };
}

function classifyPair(a, b) {
  if (a === "-" || b === "-") return "gap";
  return a === b ? "match" : "mismatch";
}

function createComparisonField(value = "") {
  const item = document.createElement("div");
  item.className = "comparison-item";

  const label = document.createElement("label");
  label.className = "field";

  const title = document.createElement("span");
  title.className = "comparison-label";

  const textarea = document.createElement("textarea");
  textarea.className = "comparison-sequence";
  textarea.spellcheck = false;
  textarea.autocomplete = "off";
  textarea.value = value;
  textarea.addEventListener("input", updateAlignment);

  label.append(title, textarea);

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "remove-button";
  removeButton.textContent = "删除";
  removeButton.addEventListener("click", () => {
    item.remove();
    updateComparisonLabels();
    updateAlignment();
  });

  item.append(label, removeButton);
  els.comparisonList.append(item);
  updateComparisonLabels();
}

function comparisonTextareas() {
  return [...document.querySelectorAll(".comparison-sequence")];
}

function updateComparisonLabels() {
  const items = [...document.querySelectorAll(".comparison-item")];
  items.forEach((item, index) => {
    item.querySelector(".comparison-label").textContent = `对比序列 ${index + 1}`;
    item.querySelector(".remove-button").disabled = items.length === 1;
  });
  els.addComparisonButton.disabled = items.length >= MAX_COMPARISONS;
}

function comparisonInputs() {
  return comparisonTextareas()
    .map((textarea, index) => {
      const value = cleanSequence(textarea.value);
      textarea.value = value;
      return { value, index };
    })
    .filter((item) => item.value);
}

function parsePairwiseAlignment(result, mainLength, comparisonIndex) {
  const insertions = Array.from({ length: mainLength + 1 }, () => []);
  const bases = Array.from({ length: mainLength }, () => ({
    value: "-",
    type: "gap",
    markClass: MARK_CLASSES[comparisonIndex],
  }));

  let consumedMain = 0;
  for (let i = 0; i < result.alignedMain.length; i += 1) {
    const mainChar = result.alignedMain[i];
    const comparisonChar = result.alignedComparison[i];
    const type = classifyPair(mainChar, comparisonChar);

    if (mainChar === "-") {
      insertions[consumedMain].push({
        value: comparisonChar,
        type,
        markClass: MARK_CLASSES[comparisonIndex],
      });
    } else {
      bases[consumedMain] = {
        value: comparisonChar,
        type,
        markClass: MARK_CLASSES[comparisonIndex],
      };
      consumedMain += 1;
    }
  }

  return { insertions, bases };
}

function buildAlignmentModel() {
  const main = cleanSequence(els.mainSequence.value);
  els.mainSequence.value = main;

  const comparisons = comparisonInputs().slice(0, MAX_COMPARISONS);
  const scoreValues = scores();
  const parsed = comparisons.map((comparison, order) => {
    const alignment = alignSequences(main, comparison.value, scoreValues);
    const pairTypes = [...alignment.alignedMain].map((char, index) =>
      classifyPair(char, alignment.alignedComparison[index]),
    );
    const matches = pairTypes.filter((type) => type === "match").length;

    return {
      label: `对比 ${order + 1}`,
      order,
      raw: comparison.value,
      alignment,
      pairTypes,
      score: alignment.score,
      matches,
      differences: pairTypes.length - matches,
      identity: pairTypes.length ? matches / pairTypes.length : 0,
      parsed: parsePairwiseAlignment(alignment, main.length, order),
    };
  });

  const maxInsertions = Array.from({ length: main.length + 1 }, (_, position) =>
    Math.max(0, ...parsed.map((item) => item.parsed.insertions[position].length)),
  );

  const columns = [];
  for (let position = 0; position <= main.length; position += 1) {
    for (let slot = 0; slot < maxInsertions[position]; slot += 1) {
      columns.push({ kind: "insertion", position, slot });
    }
    if (position < main.length) {
      columns.push({ kind: "base", position });
    }
  }

  return { main, comparisons: parsed, columns };
}

function marksForMainCell(column, comparisons) {
  const marks = [];
  comparisons.forEach((comparison) => {
    const markClass = MARK_CLASSES[comparison.order];
    const cell =
      column.kind === "base"
        ? comparison.parsed.bases[column.position]
        : comparison.parsed.insertions[column.position][column.slot];

    if (cell && cell.type !== "match") {
      marks.push(markClass);
    }
  });
  return marks;
}

function mainCharForColumn(main, column) {
  return column.kind === "base" ? main[column.position] : "-";
}

function comparisonCellForColumn(comparison, column) {
  if (column.kind === "base") {
    return comparison.parsed.bases[column.position];
  }

  return (
    comparison.parsed.insertions[column.position][column.slot] || {
      value: "-",
      type: "empty",
      markClass: "",
    }
  );
}

function cell(value, classes = []) {
  const element = document.createElement("span");
  element.className = ["base", ...classes.filter(Boolean)].join(" ");
  element.textContent = value;
  return element;
}

function chunkSize() {
  if (window.innerWidth < 560) return 7;
  if (window.innerWidth < 820) return 11;
  if (window.innerWidth < 1080) return 16;
  return 22;
}

function renderRow(label, values) {
  const row = document.createElement("div");
  row.className = "alignment-row";

  const rowLabel = document.createElement("span");
  rowLabel.className = "row-label";
  rowLabel.textContent = label;

  const bases = document.createElement("div");
  bases.className = "bases";
  values.forEach((item) => bases.append(item));

  row.append(rowLabel, bases);
  return row;
}

function renderAlignment(model) {
  if (!model.main && !model.comparisons.length) {
    els.board.replaceChildren();
    return;
  }

  const wrap = document.createElement("div");
  wrap.className = "alignment-blocks";
  const size = chunkSize();

  for (let start = 0; start < model.columns.length; start += size) {
    const columns = model.columns.slice(start, start + size);
    const block = document.createElement("section");
    block.className = "alignment-block";

    const range = document.createElement("div");
    range.className = "alignment-range";
    const firstBase = columns.find((column) => column.kind === "base")?.position + 1 || 1;
    const lastBase =
      [...columns].reverse().find((column) => column.kind === "base")?.position + 1 ||
      firstBase;
    range.textContent = `${firstBase}-${lastBase}`;

    const mainCells = columns.map((column) =>
      cell(mainCharForColumn(model.main, column), marksForMainCell(column, model.comparisons)),
    );
    block.append(range, renderRow("主序列", mainCells));

    model.comparisons.forEach((comparison) => {
      const comparisonCells = columns.map((column) => {
        const value = comparisonCellForColumn(comparison, column);
        const marks = value.type !== "match" && value.type !== "empty" ? [value.markClass] : [];
        return cell(value.value, marks);
      });
      block.append(renderRow(comparison.label, comparisonCells));
    });

    wrap.append(block);
  }

  els.board.replaceChildren(wrap);
}

function updateSummary(model) {
  const totalScore = model.comparisons.reduce((sum, comparison) => sum + comparison.score, 0);
  const totalDifferences = model.comparisons.reduce(
    (sum, comparison) => sum + comparison.differences,
    0,
  );
  const averageIdentity = model.comparisons.length
    ? Math.round(
        (model.comparisons.reduce((sum, comparison) => sum + comparison.identity, 0) /
          model.comparisons.length) *
          100,
      )
    : 0;

  els.scoreValue.textContent = totalScore;
  els.mainLength.textContent = model.main.length;
  els.comparisonCount.textContent = model.comparisons.length;
  els.differenceCount.textContent = totalDifferences;
  els.identityRate.textContent = `${averageIdentity}%`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wordStyleForMarks(marks) {
  const styles = [];
  if (marks.includes("mark-red")) styles.push("color:#c92f35");
  if (marks.includes("mark-underline")) styles.push("text-decoration:underline");
  if (marks.includes("mark-yellow")) styles.push("background:#ffe86b");
  if (marks.includes("mark-bold")) styles.push("font-weight:700");
  if (marks.includes("mark-italic")) styles.push("font-style:italic");
  return styles.join(";");
}

function wordRow(label, columns, model, comparison = null) {
  const sequence = columns
    .map((column) => {
      const value = comparison
        ? comparisonCellForColumn(comparison, column)
        : { value: mainCharForColumn(model.main, column), type: "main" };
      const marks = comparison
        ? value.type !== "match" && value.type !== "empty"
          ? [value.markClass]
          : []
        : marksForMainCell(column, model.comparisons);
      const style = wordStyleForMarks(marks);
      return style
        ? `<span style="${style}">${escapeHtml(value.value)}</span>`
        : escapeHtml(value.value);
    })
    .join("");

  return `
    <p style="font-weight:700;margin:14px 0 6px;">${escapeHtml(label)}</p>
    <p style="font-family:'Courier New',monospace;font-size:12pt;line-height:1.7;word-break:break-all;margin:0;">${sequence}</p>
  `;
}

function exportWord() {
  const model = updateAlignment();
  const totalDifferences = model.comparisons.reduce(
    (sum, comparison) => sum + comparison.differences,
    0,
  );
  const totalScore = model.comparisons.reduce((sum, comparison) => sum + comparison.score, 0);

  const rows = [
    wordRow("主序列", model.columns, model),
    ...model.comparisons.map((comparison) =>
      wordRow(`对比序列 ${comparison.order + 1}`, model.columns, model, comparison),
    ),
  ].join("");

  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>序列对齐比对结果</title>
      </head>
      <body style="font-family:'Microsoft YaHei',Arial,sans-serif;color:#17211f;">
        <h1 style="font-size:20pt;margin:0 0 12px;">序列对齐比对结果</h1>
        <p style="margin:0 0 16px;color:#64706c;">
          主序列长度：${model.main.length}　对比条数：${model.comparisons.length}　差异总数：${totalDifferences}　总得分：${totalScore}
        </p>
        ${rows}
      </body>
    </html>
  `;

  const blob = new Blob(["\ufeff", html], { type: "application/msword;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "序列对齐比对结果.doc";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function updateAlignment() {
  const model = buildAlignmentModel();
  updateSummary(model);
  renderAlignment(model);
  return model;
}

DEFAULT_COMPARISONS.forEach((value) => createComparisonField(value));

els.mainSequence.addEventListener("input", updateAlignment);
els.alignButton.addEventListener("click", updateAlignment);
els.exportWordButton.addEventListener("click", exportWord);
els.addComparisonButton.addEventListener("click", () => {
  if (comparisonTextareas().length < MAX_COMPARISONS) {
    createComparisonField("");
    updateAlignment();
  }
});

[els.matchScore, els.mismatchScore, els.gapScore].forEach((el) => {
  el.addEventListener("input", updateAlignment);
});

updateAlignment();
window.addEventListener("resize", updateAlignment);
