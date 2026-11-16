import * as Plot from '@observablehq/plot';
import { useEffect, useRef } from 'react';
import { useCube } from '../../contexts/CubeContext';

export default function CrossTabChart({ id, fields }) {
  const { mdhist, engine, filteredCells, addFilter } = useCube();
  const containerRef = useRef(null);

  const fieldA = fields?.x;
  const fieldB = fields?.y;
  const measure = fields?.value ?? 'count';

  useEffect(() => {
    if (!mdhist || !engine || !containerRef.current || !fieldA || !fieldB) return;

    const data = engine.crossTab(filteredCells, fieldA, fieldB, measure);
    if (data.length === 0) {
      containerRef.current.innerHTML = '<p style="padding:1rem;color:#9ca3af;font-size:.875rem">No data for current filters.</p>';
      return;
    }

    // Stable domain ordering from mdhist dimension definitions
    const dimA = mdhist.dimensions.find((d) => d.field === fieldA);
    const dimB = mdhist.dimensions.find((d) => d.field === fieldB);
    const domainA = dimA?.values?.map(String) ?? [...new Set(data.map((d) => String(d.a)))];
    const domainB = dimB?.values?.map(String) ?? [...new Set(data.map((d) => String(d.b)))];

    const plotData = data.map((d) => ({ ...d, a: String(d.a), b: String(d.b) }));
    const maxVal = Math.max(...plotData.map((d) => d.value), 1);

    const plot = Plot.plot({
      marginBottom: 90,
      marginLeft: 100,
      x: { domain: domainA, tickRotate: -35, label: null },
      y: { domain: domainB, label: null },
      color: { scheme: 'blues', domain: [0, maxVal], legend: false },
      marks: [
        Plot.cell(plotData, { x: 'a', y: 'b', fill: 'value', inset: 1 }),
        Plot.text(plotData, {
          x: 'a',
          y: 'b',
          text: (d) => d.value > 0 ? d.value.toLocaleString() : '',
          fill: (d) => d.value > maxVal * 0.6 ? 'white' : '#1f2937',
          fontSize: 11,
          fontWeight: '600',
        }),
      ],
    });

    // Click cell → two simultaneous filters (one per axis)
    plot.addEventListener('click', (e) => {
      const xScale = plot.scale('x');
      const yScale = plot.scale('y');
      if (!xScale?.apply || !yScale?.apply) return;

      const svgRect = plot.getBoundingClientRect();
      if (svgRect.width === 0 || svgRect.height === 0) return;

      const svgW = parseFloat(plot.getAttribute('width')) || 640;
      const svgH = parseFloat(plot.getAttribute('height')) || 400;
      const xInSvg = (e.clientX - svgRect.left) * (svgW / svgRect.width);
      const yInSvg = (e.clientY - svgRect.top) * (svgH / svgRect.height);

      const xBw = xScale.bandwidth ?? 0;
      const yBw = yScale.bandwidth ?? 0;

      const xVal = xScale.domain.find((v) => {
        const left = xScale.apply(v);
        return xInSvg >= left && xInSvg < left + xBw;
      });
      const yVal = yScale.domain.find((v) => {
        const top = yScale.apply(v);
        return yInSvg >= top && yInSvg < top + yBw;
      });

      if (xVal === undefined || yVal === undefined) return;

      addFilter({ id: `${id}-${fieldA}`, field: fieldA, operation: 'eq', values: xVal });
      addFilter({ id: `${id}-${fieldB}`, field: fieldB, operation: 'eq', values: yVal });
    });

    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(plot);

    return () => {
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, [mdhist, engine, filteredCells, fieldA, fieldB, measure, id, addFilter]);

  return <div ref={containerRef} className="w-full h-full overflow-auto" />;
}
