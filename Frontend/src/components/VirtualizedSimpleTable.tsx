import { memo, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { FixedSizeList, type ListChildComponentProps } from "react-window";

type RowRenderer<T> = (item: T, index: number) => React.ReactNode;

type ItemData<T> = {
  items: T[];
  renderRow: RowRenderer<T>;
};

type VirtualRowProps<T> = ListChildComponentProps<ItemData<T>>;

function VirtualizedRowInner<T>({ index, style, data }: VirtualRowProps<T>) {
  const item = data.items[index];
  return (
    <tr
      style={{
        ...style,
        borderBottom: "1px solid #D4F0EB",
        boxSizing: "border-box",
        width: "100%",
      }}
    >
      {data.renderRow(item, index)}
    </tr>
  );
}

const VirtualizedRow = memo(VirtualizedRowInner) as typeof VirtualizedRowInner;

interface VirtualizedSimpleTableProps<T> {
  header: React.ReactNode;
  colgroup?: React.ReactNode;
  items: T[];
  rowHeight?: number;
  maxHeight?: number;
  renderRow: RowRenderer<T>;
  ariaLabel?: string;
  className?: string;
  style?: CSSProperties;
}

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  const itemCount = items.length;
  const viewportHeight =
    itemCount === 0
      ? rowHeight * 2
      : Math.min(maxHeight, Math.max(rowHeight * 3, Math.min(itemCount * rowHeight, maxHeight)));

  const itemData = useMemo<ItemData<T>>(() => ({ items, renderRow }), [items, renderRow]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const updateWidth = () => {
      const next = el.clientWidth;
      if (next > 0) setWidth(next);
    };

    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const containerStyle: CSSProperties = useMemo(
    () => ({
      position: "relative",
      maxHeight,
      height: viewportHeight,
      overflow: "auto",
      width: "100%",
      ...style,
    }),
    [maxHeight, style, viewportHeight]
  );

  return (
    <div aria-label={ariaLabel} className={className}>
      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
        {colgroup}
        {header}
      </table>
      <div ref={scrollRef} style={containerStyle}>
        {width > 0 && itemCount > 0 ? (
          <table style={{ width, borderCollapse: "collapse", tableLayout: "fixed" }}>
            {colgroup}
            <tbody>
              <FixedSizeList
                height={viewportHeight}
                width={width}
                itemCount={itemCount}
                itemSize={rowHeight}
                itemData={itemData}
                overscanCount={10}
                innerElementType="tbody"
              >
                {VirtualizedRow}
              </FixedSizeList>
            </tbody>
          </table>
        ) : itemCount > 0 ? (
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", visibility: "hidden", position: "absolute", pointerEvents: "none" }} aria-hidden>
            {colgroup}
            <tbody>
              {items.slice(0, 1).map((item, index) => (
                <tr key={index}>{renderRow(item, index)}</tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </div>
  );
}
