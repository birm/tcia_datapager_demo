import * as Plot from '@observablehq/plot';
import { useEffect, useRef } from 'react';
import { useCube } from '../../contexts/CubeContext';

// Find which band of a Plot band scale contains `pos` (in SVG viewBox units).
function bandAt(scale, pos) {
  const bw = scale.bandwidth ?? 0;
  return scale.domain.find((v) => {
    const start = scale.apply(v);
    return pos >= start && pos < start + bw;
  });
}

export default function DistributionChart({
  id,
  fields,
  overlayMode = false,
  horizontal = false,
  dualAxisThreshold = 0.1,
}) {
  const { mdhist, engine, filteredCells, grandTotals, addFilter } = useCube();
  const containerRef = useRef(null);

  const xField = fields?.x;
  const yField = fields?.y ?? 'count';

  useEffect(() => {
    if (!mdhist || !engine || !containerRef.current || !xField) return;

    // Measure the container so the SVG fills it exactly — prevents overflow-hidden from
    // clipping the bottom margin where rotated x-axis tick labels live.
    const containerH = containerRef.current.clientHeight || 300;
    // Horizontal charts may scroll vertically; leave room for the scrollbar.
    const containerW = (containerRef.current.clientWidth || 640) - (horizontal ? 12 : 0);
    const measureLabel = mdhist.measures?.find((m) => m.field === yField)?.label ?? yField;

    const filtered = engine.marginalize(filteredCells, xField, [yField]);
    const full = overlayMode ? engine.marginalize(mdhist.cells, xField, [yField]) : [];

    const filteredTotal = filtered.reduce((s, d) => s + (d[yField] ?? 0), 0);
    const grandTotal = grandTotals[yField] ?? 1;
    const ratio = grandTotal > 0 ? filteredTotal / grandTotal : 1;
    const showDualAxis = ratio > 0 && ratio < dualAxisThreshold;

    // Ordinal dimensions keep their declared order; categorical ones sort by size.
    const dim = mdhist.dimensions?.find((d) => d.field === xField);
    const present = full.length > 0 ? full : filtered;
    const catDomain =
      dim?.type === 'ordinal' && dim.values
        ? dim.values.map(String).filter((v) => present.some((d) => String(d.value) === v))
        : [...present].sort((a, b) => b[yField] - a[yField]).map((d) => String(d.value));

    const cat = (d) => String(d.value);
    const pctText = (d) => `${(((d[yField] ?? 0) / grandTotal) * 100).toFixed(1)}%`;
    const marks = [];
    let plot;

    if (horizontal) {
      // Category on y, measure on x. Value labels on every bar since long lists are
      // hard to read off an axis.
      if (overlayMode && full.length > 0) {
        marks.push(Plot.barX(full, { y: cat, x: yField, fill: '#e5e7eb' }));
      }
      marks.push(Plot.barX(filtered, { y: cat, x: yField, fill: '#3b82f6' }));
      marks.push(
        Plot.text(filtered, {
          y: cat,
          x: yField,
          text: (d) => (showDualAxis ? pctText(d) : Math.round(d[yField] ?? 0).toLocaleString()),
          textAnchor: 'start',
          dx: 4,
          fontSize: 10,
          fill: '#374151',
        })
      );
      marks.push(Plot.ruleX([0]));
      const longest = Math.max(...catDomain.map((s) => s.length), 4);
      plot = Plot.plot({
        width: containerW,
        height: Math.max(containerH, catDomain.length * 16 + 40),
        marginLeft: Math.min(Math.max(longest * 6.2, 60), 230),
        marginRight: 48,
        y: { domain: catDomain, label: null, tickSize: 0 },
        x: { label: measureLabel, grid: true, insetRight: 10 },
        marks,
      });
    } else {
      if (overlayMode && full.length > 0) {
        marks.push(Plot.barY(full, { x: cat, y: yField, fill: '#e5e7eb' }));
      }
      marks.push(Plot.barY(filtered, { x: cat, y: yField, fill: '#3b82f6' }));

      // Right-side percentage axis + bar labels when filtered cohort is rare (<threshold)
      if (showDualAxis) {
        const total = grandTotal;
        marks.push(
          Plot.axisY({
            anchor: 'right',
            label: '% of dataset',
            tickFormat: (v) => `${((v / total) * 100).toFixed(1)}%`,
            color: '#9ca3af',
          })
        );
        marks.push(
          Plot.text(filtered, {
            x: cat,
            y: yField,
            text: pctText,
            dy: -8,
            fontSize: 10,
            fontWeight: '600',
            fill: '#374151',
          })
        );
      }
      marks.push(Plot.ruleY([0]));
      plot = Plot.plot({
        width: containerW,
        height: containerH,
        marginBottom: 90,
        marginRight: showDualAxis ? 60 : 20,
        x: { domain: catDomain, tickRotate: -35, label: null },
        y: { label: measureLabel },
        marks,
      });
    }

    // Click-to-filter via Observable Plot's scale API.
    // plot.scale(axis).apply(domainValue) returns position in SVG viewBox coordinates.
    // The SVG may render at a different pixel size than its viewBox (CSS scaling),
    // so we correct for the ratio before comparing against scale positions.
    plot.addEventListener('click', (e) => {
      const scale = plot.scale(horizontal ? 'y' : 'x');
      if (!scale?.apply || !scale?.domain) return;
      const svgRect = plot.getBoundingClientRect();
      if (svgRect.width === 0) return;
      let pos;
      if (horizontal) {
        const viewBoxHeight = parseFloat(plot.getAttribute('height')) || svgRect.height;
        pos = (e.clientY - svgRect.top) * (viewBoxHeight / (svgRect.height || 1));
      } else {
        const viewBoxWidth = parseFloat(plot.getAttribute('width')) || 640;
        pos = (e.clientX - svgRect.left) * (viewBoxWidth / svgRect.width);
      }
      const value = bandAt(scale, pos);
      if (value === undefined) return;
      addFilter({ id: `${id}-${xField}`, field: xField, operation: 'eq', values: value });
    });
    if (plot.style) plot.style.cursor = 'pointer';

    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(plot);

    return () => {
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, [mdhist, engine, filteredCells, grandTotals, xField, yField, overlayMode, horizontal, dualAxisThreshold, id, addFilter]);

  return (
    <div
      ref={containerRef}
      className={horizontal ? 'w-full h-full overflow-y-auto overflow-x-hidden' : 'w-full h-full'}
    />
  );
}
