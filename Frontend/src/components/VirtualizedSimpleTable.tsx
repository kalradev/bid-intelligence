import React, { memo, useMemo } from "react";
import type { CSSProperties } from "react";
import { AutoSizer } from "react-virtualized-auto-sizer";
import { FixedSizeList } from "react-window";

type RowRenderer<T> = (item: T, index: number) => React.ReactNode;

type VirtualRowProps = {
  index: number;
  style: CSSProperties;
};

interface VirtualizedSimpleTableProps<T> {
  /** Column headers (already styled content) */
  header: React.ReactNode;
  /** Optional column group for fixed layout alignment */
  colgroup?: React.ReactNode;
  /** Data items */
  items: T[];
  /** Row height in pixels (fixed for performance) */
  rowHeight?: number;
  /** Max viewport height for the scroll container */
  maxHeight?: number;
  /** Render a single row (<tr>...</tr>) */
  renderRow: RowRenderer<T>;
  /** Optional aria-label for a11y */
  ariaLabel?: string;
  /** Optional className for outer container */
  className?: string;
  /** Optional style overrides */
  style?: CSSProperties;
}

/**
 * VirtualizedSimpleTable
 * Renders a fixed header table with a virtualized tbody.
 * Keep tableLayout fixed on the consumer table for stable column widths.
 */
export function VirtualizedSimpleTable<T>({
  header,
  colgroup,
  items,
  rowHeight = 56,
  maxHeight = 480,
  renderRow,
  ariaLabel,
  className,
  style,
}: VirtualizedSimpleTableProps<T>) {
  const itemCount = items.length;
  const viewportHeight = itemCount === 0 ? rowHeight * 2 : Math.min(maxHeight, Math.max(rowHeight * 3, Math.min(itemCount * rowHeight, maxHeight)));
  const containerStyle: CSSProperties = useMemo(
    () => ({
      position: "relative",
      maxHeight,
      height: viewportHeight,
      overflow: "hidden",
      willChange: "transform",
      contain: "strict",
      ...style,
    }),
    [itemCount, maxHeight, rowHeight, style, viewportHeight]
  );

  const Row = memo(({ index, style: rowStyle }: VirtualRowProps) => {
    const item = items[index];
    return (
      <tr style={{ ...rowStyle, borderBottom: "1px solid #D4F0EB" }}>
        {renderRow(item, index)}
      </tr>
    );
  });
  Row.displayName = "VirtualizedRow";

  return (
    <div aria-label={ariaLabel} className={className}>
      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
        {colgroup}
        {header}
      </table>
      <div style={containerStyle}>
        <AutoSizer
          renderProp={({ width, height }) => {
            if (width == null || height == null) return null;
            return (
              <table style={{ width, borderCollapse: "collapse", tableLayout: "fixed" }}>
                {colgroup}
                <tbody>
                  <FixedSizeList
                    height={height}
                    width={width}
                    itemCount={itemCount}
                    itemSize={rowHeight}
                    overscanCount={4}
                    innerElementType="tbody"
                  >
                    {Row}
                  </FixedSizeList>
                </tbody>
              </table>
            );
          }}
        />
      </div>
    </div>
  );
}

