import React, { CSSProperties, memo, useMemo } from "react";
import AutoSizer from "react-virtualized-auto-sizer";
import { FixedSizeList, ListChildComponentProps } from "react-window";

type RowRenderer<T> = (item: T, index: number) => React.ReactNode;

interface VirtualizedSimpleTableProps<T> {
  /** Column headers (already styled content) */
  header: React.ReactNode;
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
  items,
  rowHeight = 56,
  maxHeight = 480,
  renderRow,
  ariaLabel,
  className,
  style,
}: VirtualizedSimpleTableProps<T>) {
  const itemCount = items.length;
  const containerStyle: CSSProperties = useMemo(
    () => ({
      position: "relative",
      maxHeight,
      height: Math.min(maxHeight, Math.max(rowHeight * Math.min(itemCount, 8), rowHeight * Math.min(itemCount, 1))) || rowHeight * 3,
      overflow: "hidden",
      willChange: "transform",
      contain: "strict",
      ...style,
    }),
    [itemCount, maxHeight, rowHeight, style]
  );

  const Row = memo(({ index, style: rowStyle }: ListChildComponentProps) => {
    const item = items[index];
    return (
      <tr style={{ ...rowStyle, borderBottom: "1px solid #EAEFEF" }}>
        {renderRow(item, index)}
      </tr>
    );
  });
  Row.displayName = "VirtualizedRow";

  return (
    <div aria-label={ariaLabel} className={className}>
      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
        {header}
      </table>
      <div style={containerStyle}>
        <AutoSizer>
          {({ width, height }) => (
            <table style={{ width, borderCollapse: "collapse", tableLayout: "fixed" }}>
              <tbody>
                <FixedSizeList
                  height={height}
                  width={width}
                  itemCount={itemCount}
                  itemSize={rowHeight}
                  overscanCount={6}
                  innerElementType="tbody"
                >
                  {Row}
                </FixedSizeList>
              </tbody>
            </table>
          )}
        </AutoSizer>
      </div>
    </div>
  );
}

