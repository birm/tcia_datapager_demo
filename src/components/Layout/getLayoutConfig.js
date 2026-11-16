// Ported from eaglescope/source/common/utils.js
// Fixes: mutating sort → spread copy; localeCompare typo (displayName→title); priority default.

function createMatrix(rows, cols = rows) {
  return Array.from({ length: rows }, () => new Array(cols));
}

function hasSpace(matrix, pos, size) {
  if (matrix.length === 0) return true;
  // Wide charts must start at an even column so they align on the 2-unit grid.
  // The original eaglescope code also constrained tall charts to odd rows; that
  // constraint is dropped here because it prevented any chart from sitting at y=0.
  if (size[0] > 1 && pos[0] % 2 !== 0) return false;
  for (let i = pos[1]; i < pos[1] + size[1]; i++) {
    if (i >= matrix.length) break;
    for (let j = pos[0]; j < pos[0] + size[0]; j++) {
      if (j >= matrix[0].length || matrix[i][j]) return false;
    }
  }
  return true;
}

function getPosition(matrix, size) {
  for (let i = 0; i < matrix.length; i++) {
    for (let j = 0; j < (matrix[i]?.length ?? 0); j++) {
      if (!matrix[i][j] && hasSpace(matrix, [j, i], size)) return [j, i];
    }
  }
  return [0, matrix.length];
}

function fillMatrix(matrix, val, pos, size) {
  for (let i = pos[1]; i < pos[1] + size[1]; i++) {
    for (let j = pos[0]; j < pos[0] + size[0]; j++) {
      if (matrix[i]) matrix[i][j] = val;
    }
  }
}

export function getLayoutConfig(chartsConfig, cols, resizable = false) {
  const layout = [];
  const matrix = createMatrix(cols);

  const sorted = [...chartsConfig].sort(
    (a, b) => (b.priority ?? 0) - (a.priority ?? 0) || (a.title ?? '').localeCompare(b.title ?? '')
  );

  for (const chart of sorted) {
    const size = chart.expandWidth ? [cols, chart.size?.[1] ?? 1] : chart.size ?? [1, 1];
    const pos = matrix.length === 0 ? [0, 0] : getPosition(matrix, size);

    while (matrix.length <= pos[1] + size[1]) {
      matrix.push(new Array(cols).fill(null));
    }

    fillMatrix(matrix, chart.id, pos, size);
    layout.push({ i: chart.id, x: pos[0], y: pos[1], w: size[0], h: size[1], isResizable: resizable });
  }

  return { layout };
}
