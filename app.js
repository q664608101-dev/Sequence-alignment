const MAX_COMPARISONS = 5;
const DEFAULT_COMPARISONS = [{ name: "对比序列 1", sequence: "GCTA", markType: "color", color: "#c92f35" }];
const DEFAULT_MARKS = [
  { markType: "color", color: "#c92f35" },
  { markType: "underline", color: "#166fca" },
  { markType: "bold", color: "#117c70" },
  { markType: "italic", color: "#8a4bd8" },
  { markType: "color", color: "#d98200" },
];
const MARK_TYPE_LABELS = {
  color: "颜色",
  underline: "下划线",
  bold: "加粗",
  italic: "斜体",
};

const els = {
  mainName: document.querySelector("#mainName"),
  mainSequence: document.querySelector("#mainSequence"),
  comparisonList: document.querySelector("#comparisonList"),
  addComparisonButton: document.querySelector("#addComparisonButton"),
  legend: document.querySelector("#legend"),
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

  let alignedMain = "";
  let alignedComparison = "";
  let i = seqA.length;
  let j = seqB.length;

  while (i > 0 || j > 0) {
    const direction = trace[i][j];

    if (i > 0 && j > 0 && direction === "diagonal") {
      alignedMain = seqA[i - 1] + alignedMain;
      alignedComparison = seqB[j - 1] + alignedComparison;
      i -= 1;
      j -= 1;
    } else if (i > 0 && (direction === "up" || j === 0)) {
      alignedMain = seqA[i - 1] + alignedMain;
      alignedComparison = "-" + alignedComparison;
      i -= 1;
    } else {
      alignedMain = "-" + alignedMain;
      alignedComparison = seqB[j - 1] + alignedComparison;
      j -= 1;
    }
  }

  return {
    alignedMain,
    alignedComparison,
    score: matrix[seqA.length][seqB.length],
  };
}

function classifyPair(a, b) {
  if (a === "-" || b === "-") return "gap";
  return a === b ? "match" : "mismatch";
}

function createOption(value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  return option;
}

function createComparisonField(config = {}) {
  const index = comparisonItems().length;
  const defaults = DEFAULT_MARKS[index] || DEFAULT_MARKS[0];
  const item = document.createElement("div");
  item.className = "comparison-item";

  const top = document.createElement("div");
  top.className = "comparison-config";

  const nameField = document.createElement("label");
  nameField.className = "name-field";
  const nameLabel = document.createElement("span");
  nameLabel.textContent = "名称";
  const nameInput = document.createElement("input");
  nameInput.className = "comparison-name";
  nameInput.type = "text";
  nameInput.value = config.name || `对比序列 ${index + 1}`;
  nameInput.addEventListener("input", updateAlignment);
  nameField.append(nameLabel, nameInput);

  const markField = document.createElement("label");
  markField.className = "name-field";
  const markLabel = document.createElement("span");
  markLabel.textContent = "标记方式";
  const markSelect = document.createElement("select");
  markSelect.className = "comparison-mark";
  Object.entries(MARK_TYPE_LABELS).forEach(([value, label]) => {
    markSelect.append(createOption(value, label));
  });
  markSelect.value = config.markType || defaults.markType;
  markSelect.addEventListener("change", updateAlignment);
  markField.append(markLabel, markSelect);

  const colorField = document.createElement("label");
  colorField.className = "name-field color-field";
  const colorLabel = document.createElement("span");
  colorLabel.textContent = "颜色";
  const colorInput = document.createElement("input");
  colorInput.className = "comparison-color";
  colorInput.type = "color";
  colorInput.value = config.color || defaults.color;
  colorInput.addEventListener("input", updateAlignment);
  colorField.append(colorLabel, colorInput);

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "remove-button";
  removeButton.textContent = "删除";
  removeButton.addEventListener("click", () => {
    item.remove();
    updateComparisonControls();
    updateAlignment();
  });

  top.append(nameField, markField, colorField, removeButton);

  const sequenceField = document.createElement("label");
  sequenceField.className = "field";
  const sequenceLabel = document.createElement("span");
  sequenceLabel.className = "comparison-label";
  const textarea = document.createElement("textarea");
  textarea.className = "comparison-sequence";
  textarea.spellcheck = false;
  textarea.autocomplete = "off";
  textarea.value = config.sequence || "";
  textarea.addEventListener("input", updateAlignment);
  sequenceField.append(sequenceLabel, textarea);

  item.append(top, sequenceField);
  els.comparisonList.append(item);
  updateComparisonControls();
}

function comparisonItems() {
  return [...document.querySelectorAll(".comparison-item")];
}

function updateComparisonControls() {
  const items = comparisonItems();
  items.forEach((item, index) => {
    item.querySelector(".comparison-label").textContent = `序列内容 ${index + 1}`;
    item.querySelector(".remove-button").disabled = items.length === 1;
  });
  els.addComparisonButton.disabled = items.length >= MAX_COMPARISONS;
}

function comparisonInputs() {
  return comparisonItems()
    .map((item, index) => {
      const textarea = item.querySelector(".comparison-sequence");
      const value = cleanSequence(textarea.value);
      textarea.value = value;
      return {
        value,
        name: item.querySelector(".comparison-name").value.trim() || `对比序列 ${index + 1}`,
        markType: item.querySelector(".comparison-mark").value,
        color: item.querySelector(".comparison-color").value,
        index,
      };
    })
    .filter((item) => item.value)
    .slice(0, MAX_COMPARISONS);
}

function parsePairwiseAlignment(result, mainLength, mark) {
  const insertions = Array.from({ length: mainLength + 1 }, () => []);
  const bases = Array.from({ length: mainLength }, () => ({
    value: "-",
    type: "gap",
    mark,
  }));

  let consumedMain = 0;
  for (let i = 0; i < result.alignedMain.length; i += 1) {
    const mainChar = result.alignedMain[i];
    const comparisonChar = result.alignedComparison[i];
    const type = classifyPair(mainChar, comparisonChar);

    if (mainChar === "-") {
      insertions[consumedMain].push({ value: comparisonChar, type, mark });
    } else {
      bases[consumedMain] = { value: comparisonChar, type, mark };
      consumedMain += 1;
    }
  }

  return { insertions, bases };
}

function buildAlignmentModel() {
  const mainName = els.mainName.value.trim() || "主序列";
  const main = cleanSequence(els.mainSequence.value);
  els.mainSequence.value = main;

  const scoreValues = scores();
  const comparisons = comparisonInputs().map((comparison, order) => {
    const mark = {
      type: comparison.markType,
      color: comparison.color,
      name: comparison.name,
      order,
    };
    const alignment = alignSequences(main, comparison.value, scoreValues);
    const pairTypes = [...alignment.alignedMain].map((char, index) =>
      classifyPair(char, alignment.alignedComparison[index]),
    );
    const matches = pairTypes.filter((type) => type === "match").length;

    return {
      ...comparison,
      order,
      mark,
      alignment,
      pairTypes,
      score: alignment.score,
      matches,
      differences: pairTypes.length - matches,
      identity: pairTypes.length ? matches / pairTypes.length : 0,
      parsed: parsePairwiseAlignment(alignment, main.length, mark),
    };
  });

  const maxInsertions = Array.from({ length: main.length + 1 }, (_, position) =>
    Math.max(0, ...comparisons.map((item) => item.parsed.insertions[position].length)),
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

  return { mainName, main, comparisons, columns };
}

function marksForMainCell(column, comparisons) {
  const marks = [];
  comparisons.forEach((comparison) => {
    const cell =
      column.kind === "base"
        ? comparison.parsed.bases[column.position]
        : comparison.parsed.insertions[column.position][column.slot];

    if (cell && cell.type !== "match") {
      marks.push(comparison.mark);
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
      mark: null,
    }
  );
}

function styleTextForMarks(marks) {
  const styles = [];
  const colorMark = [...marks].reverse().find((mark) => mark.type === "color");
  if (colorMark) styles.push(`color:${colorMark.color}`);
  if (marks.some((mark) => mark.type === "underline")) {
    const underlineColor = [...marks].reverse().find((mark) => mark.type === "underline")?.color;
    styles.push("text-decoration-line:underline", "text-decoration-thickness:3px", "text-underline-offset:5px");
    if (underlineColor) styles.push(`text-decoration-color:${underlineColor}`);
  }
  if (marks.some((mark) => mark.type === "bold")) styles.push("font-weight:950");
  if (marks.some((mark) => mark.type === "italic")) styles.push("font-style:italic");
  return styles.join(";");
}

function cell(value, marks = []) {
  const element = document.createElement("span");
  element.className = "base";
  element.textContent = value;
  const style = styleTextForMarks(marks);
  if (style) element.setAttribute("style", style);
  if (marks.length) element.title = marks.map((mark) => mark.name).join("、");
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

function columnRange(columns) {
  const firstBase = columns.find((column) => column.kind === "base")?.position + 1 || 1;
  const lastBase =
    [...columns].reverse().find((column) => column.kind === "base")?.position + 1 || firstBase;
  return `${firstBase}-${lastBase}`;
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
    range.textContent = columnRange(columns);

    const mainCells = columns.map((column) =>
      cell(mainCharForColumn(model.main, column), marksForMainCell(column, model.comparisons)),
    );
    block.append(range, renderRow(model.mainName, mainCells));

    model.comparisons.forEach((comparison) => {
      const comparisonCells = columns.map((column) => {
        const value = comparisonCellForColumn(comparison, column);
        const marks = value.type !== "match" && value.type !== "empty" ? [comparison.mark] : [];
        return cell(value.value, marks);
      });
      block.append(renderRow(comparison.name, comparisonCells));
    });

    wrap.append(block);
  }

  els.board.replaceChildren(wrap);
}

function renderLegend(model) {
  els.legend.replaceChildren();
  model.comparisons.forEach((comparison) => {
    const item = document.createElement("span");
    const swatch = document.createElement("i");
    swatch.className = "legend-swatch";
    const style = styleTextForMarks([comparison.mark]);
    if (style) swatch.setAttribute("style", style);
    const label = document.createElement("span");
    label.textContent = `${comparison.name}：${MARK_TYPE_LABELS[comparison.mark.type]}`;
    item.append(swatch, label);
    els.legend.append(item);
  });
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
  const style = styleTextForMarks(marks).replace(/text-decoration-line/g, "text-decoration");
  return style ? `style="${style}"` : "";
}

function wordRow(label, columns, model, comparison = null) {
  const sequence = columns
    .map((column) => {
      const value = comparison
        ? comparisonCellForColumn(comparison, column)
        : { value: mainCharForColumn(model.main, column), type: "main" };
      const marks = comparison
        ? value.type !== "match" && value.type !== "empty"
          ? [comparison.mark]
          : []
        : marksForMainCell(column, model.comparisons);
      return `<span ${wordStyleForMarks(marks)}>${escapeHtml(value.value)}</span>`;
    })
    .join("");

  return `
    <p style="font-weight:700;margin:12px 0 4px;">${escapeHtml(label)}</p>
    <p style="font-family:'Courier New',monospace;font-size:12pt;line-height:1.7;word-break:break-all;margin:0 0 6px;">${sequence}</p>
  `;
}

function wordContinuousSection(model) {
  return `
    <h2 style="font-size:16pt;margin:22px 0 10px;">连续序列形式</h2>
    ${wordRow(model.mainName, model.columns, model)}
    ${model.comparisons.map((comparison) => wordRow(comparison.name, model.columns, model, comparison)).join("")}
  `;
}

function wordBlockSection(model) {
  const size = 22;
  const blocks = [];
  for (let start = 0; start < model.columns.length; start += size) {
    const columns = model.columns.slice(start, start + size);
    const rows = [
      wordRow(model.mainName, columns, model),
      ...model.comparisons.map((comparison) => wordRow(comparison.name, columns, model, comparison)),
    ].join("");
    blocks.push(`
      <div style="border-top:1px solid #d7dfdc;padding-top:10px;margin-top:14px;">
        <p style="color:#64706c;font-weight:700;margin:0 0 8px;">${columnRange(columns)}</p>
        ${rows}
      </div>
    `);
  }

  return `<h2 style="font-size:16pt;margin:26px 0 10px;">分块对照形式</h2>${blocks.join("")}`;
}

function exportWord() {
  const model = updateAlignment();
  const totalDifferences = model.comparisons.reduce(
    (sum, comparison) => sum + comparison.differences,
    0,
  );
  const totalScore = model.comparisons.reduce((sum, comparison) => sum + comparison.score, 0);

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
        ${wordContinuousSection(model)}
        ${wordBlockSection(model)}
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
  renderLegend(model);
  return model;
}

DEFAULT_COMPARISONS.forEach((config) => createComparisonField(config));

els.mainName.addEventListener("input", updateAlignment);
els.mainSequence.addEventListener("input", updateAlignment);
els.alignButton.addEventListener("click", updateAlignment);
els.exportWordButton.addEventListener("click", exportWord);
els.addComparisonButton.addEventListener("click", () => {
  if (comparisonItems().length < MAX_COMPARISONS) {
    createComparisonField();
    updateAlignment();
  }
});

[els.matchScore, els.mismatchScore, els.gapScore].forEach((el) => {
  el.addEventListener("input", updateAlignment);
});

updateAlignment();
window.addEventListener("resize", updateAlignment);
