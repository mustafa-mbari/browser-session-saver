import { useState, useEffect } from 'react';
import { getFaviconUrl } from '@core/utils/favicon';
import type { SpanValue } from '@core/types/newtab.types';

interface NativeNode {
  id: string;
  title: string;
  url?: string;
  children?: NativeNode[];
}

function getFaviconSrc(url: string): string {
  return getFaviconUrl(url, 16);
}

function BookmarkNode({ node, depth = 0 }: { node: NativeNode; depth?: number }) {
  const [expanded, setExpanded] = useState(depth === 0);

  if (node.url) {
    return (
      <a
        href={node.url}
        className="flex items-center gap-2 py-1 rounded hover:bg-white/10 text-xs truncate transition-colors"
        style={{ color: 'var(--newtab-text)', paddingLeft: `${8 + depth * 14}px`, paddingRight: 8 }}
        title={node.title || node.url}
      >
        <img
          src={getFaviconSrc(node.url)}
          alt=""
          className="w-3 h-3 rounded shrink-0"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
        <span className="truncate">{node.title || node.url}</span>
      </a>
    );
  }

  // Folder
  return (
    <div>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 py-1 w-full text-left rounded hover:bg-white/10 text-xs transition-colors"
        style={{ color: 'var(--newtab-text-secondary)', paddingLeft: `${8 + depth * 14}px`, paddingRight: 8 }}
      >
        <span className="text-[10px] shrink-0">{expanded ? '▾' : '▸'}</span>
        <span className="truncate font-medium">{node.title || 'Folder'}</span>
      </button>
      {expanded && node.children && node.children.map((child) => (
        <BookmarkNode key={child.id} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

interface Props {
  colSpan: SpanValue;
  rowSpan: SpanValue;
}

export default function NativeBookmarksCardBody({ colSpan: _colSpan, rowSpan: _rowSpan }: Props) {
  const [tree, setTree] = useState<NativeNode[]>([]);

  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.bookmarks) {
      chrome.bookmarks.getTree((result) => {
        setTree(result as NativeNode[]);
      });
    }
  }, []);

  // Skip the invisible root, show Bookmarks Bar, Other Bookmarks, etc.
  const topLevel = tree.flatMap((root) => root.children ?? []);

  if (topLevel.length === 0) {
    return (
      <div className="flex items-center justify-center h-full px-4 py-6">
        <p className="text-xs text-center" style={{ color: 'var(--newtab-text-secondary)' }}>
          No bookmarks found
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full py-1">
      {topLevel.map((node) => (
        <BookmarkNode key={node.id} node={node} depth={0} />
      ))}
    </div>
  );
}
