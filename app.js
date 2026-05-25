const els = {
  sequenceA: document.querySelector("#sequenceA"),
  sequenceB: document.querySelector("#sequenceB"),
  matchScore: document.querySelector("#matchScore"),
  mismatchScore: document.querySelector("#mismatchScore"),
  gapScore: document.querySelector("#gapScore"),
  alignButton: document.querySelector("#alignButton"),
  swapButton: document.querySelector("#swapButton"),
  exportWordButton: document.querySelector("#exportWordButton"),
  board: document.querySelector("#alignmentBoard"),
  scoreValue: document.querySelector("#scoreValue"),
  alignedLength: document.querySelector("#alignedLength"),
  matchCount: document.querySelector("#matchCount"),
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

function alignSequences(seqA, seqB, scores) {
  const rows = seqA.length + 1;
  const cols = seqB.length + 1;
  const matrix = Array.from({ length: rows }, () => Array(cols).fill(0));
  const trace = Array.from({ length: rows }, () => Array(cols).fill(""));

  for (let i = 1; i < rows; i += 1) {
    matrix[i][0] = matrix[i - 1][0] + scores.gap;
    trace[i][0] = "up";
  }

  for (let j = 1; j < cols; j += 1) {
    matrix[0][j] = matrix[0][j - 1] + scores.gap;
    trace[0][j] = "left";
  }

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const diagonal =
        matrix[i - 1][j - 1] +
        (seqA[i - 1] === seqB[j - 1] ? scores.match : scores.mismatch);
      const up = matrix[i - 1][j] + scores.gap;
      const left = matrix[i][j - 1] + scores.gap;
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
    alignedA,
    alignedB,
    score: matrix[seqA.length][seqB.length],
  };
}

function classifyPair(a, b) {
  if (a === "-" || b === "-") return "gap";
  return a === b ? "match" : "mismatch";
}

function baseCell(value, type) {
  const cell = document.createElement("span");
  cell.className = `base ${type}`;
  cell.textContent = value;
  return cell;
}

function chunkSize() {
  if (window.innerWidth < 560) return 8;
  if (window.innerWidth < 820) return 12;
  if (window.innerWidth < 1080) return 18;
  return 24;
}

function renderBlockRow(label, chars, pairTypes) {
  const row = document.createElement("div");
  row.className = "alignment-row";

  const rowLabel = document.createElement("span");
  rowLabel.className = "row-label";
  rowLabel.textContent = label;

  const bases = document.createElement("div");
  bases.className = "bases";

  chars.forEach((char, index) => {
    bases.append(baseCell(char, pairTypes[index]));
  });

  row.append(rowLabel, bases);
  return row;
}

function renderAlignmentBlocks(charsA, charsB, pairTypes) {
  const wrap = document.createElement("div");
  wrap.className = "alignment-blocks";
  const size = chunkSize();

  for (let start = 0; start < charsA.length; start += size) {
    const end = Math.min(start + size, charsA.length);
    const block = document.createElement("section");
    block.className = "alignment-block";

    const range = document.createElement("div");
    range.className = "alignment-range";
    range.textContent = `${start + 1}-${end}`;

    block.append(
      range,
      renderBlockRow("序列 1", charsA.slice(start, end), pairTypes.slice(start, end)),
      renderBlockRow("序列 2", charsB.slice(start, end), pairTypes.slice(start, end)),
    );
    wrap.append(block);
  }

  return wrap;
}

function currentAlignment() {
  const seqA = cleanSequence(els.sequenceA.value);
  const seqB = cleanSequence(els.sequenceB.value);

  return alignSequences(seqA, seqB, {
    match: numberValue(els.matchScore, 2),
    mismatch: numberValue(els.mismatchScore, -1),
    gap: numberValue(els.gapScore, -2),
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wordSequenceHtml(label, chars, pairTypes) {
  const sequence = chars
    .map((char, index) => {
      const escaped = escapeHtml(char);
      return pairTypes[index] === "match"
        ? escaped
        : `<span style="color:#c92f35;font-weight:700;">${escaped}</span>`;
    })
    .join("");

  return `
    <p style="font-weight:700;margin:14px 0 6px;">${label}</p>
    <p style="font-family:'Courier New',monospace;font-size:12pt;line-height:1.7;word-break:break-all;margin:0;">${sequence}</p>
  `;
}

function exportWord() {
  updateAlignment();

  const result = currentAlignment();
  const charsA = [...result.alignedA];
  const charsB = [...result.alignedB];
  const pairTypes = charsA.map((char, index) => classifyPair(char, charsB[index]));
  const matches = pairTypes.filter((type) => type === "match").length;
  const differences = pairTypes.length - matches;
  const identity = pairTypes.length ? Math.round((matches / pairTypes.length) * 100) : 0;

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
          长度：${pairTypes.length}　匹配：${matches}　差异：${differences}　相似度：${identity}%　得分：${result.score}
        </p>
        ${wordSequenceHtml("序列 1", charsA, pairTypes)}
        ${wordSequenceHtml("序列 2", charsB, pairTypes)}
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
  const seqA = cleanSequence(els.sequenceA.value);
  const seqB = cleanSequence(els.sequenceB.value);
  els.sequenceA.value = seqA;
  els.sequenceB.value = seqB;

  if (!seqA && !seqB) {
    els.board.replaceChildren();
    return;
  }

  const result = currentAlignment();

  const charsA = [...result.alignedA];
  const charsB = [...result.alignedB];
  const pairTypes = charsA.map((char, index) => classifyPair(char, charsB[index]));
  const matches = pairTypes.filter((type) => type === "match").length;
  const differences = pairTypes.length - matches;
  const identity = pairTypes.length ? Math.round((matches / pairTypes.length) * 100) : 0;

  els.scoreValue.textContent = result.score;
  els.alignedLength.textContent = pairTypes.length;
  els.matchCount.textContent = matches;
  els.differenceCount.textContent = differences;
  els.identityRate.textContent = `${identity}%`;
  els.board.replaceChildren(renderAlignmentBlocks(charsA, charsB, pairTypes));
}

els.alignButton.addEventListener("click", updateAlignment);
els.swapButton.addEventListener("click", () => {
  const oldA = els.sequenceA.value;
  els.sequenceA.value = els.sequenceB.value;
  els.sequenceB.value = oldA;
  updateAlignment();
});
els.exportWordButton.addEventListener("click", exportWord);

[els.sequenceA, els.sequenceB, els.matchScore, els.mismatchScore, els.gapScore].forEach((el) => {
  el.addEventListener("input", updateAlignment);
});

updateAlignment();
window.addEventListener("resize", updateAlignment);
