import { useRef, useEffect, useCallback } from 'preact/hooks';
import type { TabInfo } from '../lib/tabs';

interface MentionInputProps {
  onSend: (content: string, tabIds: number[]) => void;
  disabled?: boolean;
  onTriggerTabPicker?: () => void;
  selectedTabs: TabInfo[];
  onRemoveTab: (tabId: number) => void;
}

interface ExtractedContent {
  text: string;
  tabIds: number[];
}

export function MentionInput({
  onSend,
  disabled = false,
  onTriggerTabPicker,
  selectedTabs,
  onRemoveTab,
}: MentionInputProps) {
  const inputRef = useRef<HTMLDivElement>(null);
  const insertedTabsRef = useRef<Set<number>>(new Set());

  // Extract content from the contenteditable
  const extractContent = useCallback((): ExtractedContent => {
    const container = inputRef.current;
    if (!container) {
      return { text: '', tabIds: [] };
    }

    const tabIds: number[] = [];
    let text = '';

    const processNode = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent || '';
      } else if (node instanceof HTMLElement) {
        const tabIdAttr = node.getAttribute('data-tab-id');
        if (tabIdAttr) {
          const tabId = parseInt(tabIdAttr, 10);
          tabIds.push(tabId);
          // Include tab title in text for context
          const titleSpan = node.querySelector('[data-chip-title]');
          const title = titleSpan?.textContent || node.textContent || '';
          text += `@[${title.replace('×', '').trim()}]`;
        } else {
          // Process child nodes (e.g., regular spans, divs)
          node.childNodes.forEach(processNode);
        }
      }
    };

    container.childNodes.forEach(processNode);

    return { text: text.trim(), tabIds };
  }, []);

  // Create a chip DOM element (not a Preact component - direct DOM manipulation)
  const createChipElement = useCallback((tabId: number, title: string): HTMLSpanElement => {
    const chip = document.createElement('span');
    chip.contentEditable = 'false';
    chip.setAttribute('data-tab-id', String(tabId));
    chip.className = 'inline-flex items-center px-2 py-0.5 mx-1 text-xs bg-blue-100 text-blue-800 rounded select-none align-baseline';

    const titleSpan = document.createElement('span');
    titleSpan.className = 'truncate max-w-[120px]';
    titleSpan.title = title;
    titleSpan.setAttribute('data-chip-title', 'true');
    titleSpan.textContent = title;
    chip.appendChild(titleSpan);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'ml-1 hover:text-blue-600 focus:outline-none';
    removeBtn.textContent = '×';
    removeBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      chip.remove();
      insertedTabsRef.current.delete(tabId);
      onRemoveTab(tabId);
    };
    chip.appendChild(removeBtn);

    return chip;
  }, [onRemoveTab]);

  // Insert chip at current cursor position
  const insertChipAtCursor = useCallback((tabId: number, title: string) => {
    const container = inputRef.current;
    if (!container) return;

    container.focus();

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      // No selection, append to end
      const chip = createChipElement(tabId, title);
      container.appendChild(chip);
      // Move cursor after chip
      const range = document.createRange();
      range.setStartAfter(chip);
      range.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(range);
      return;
    }

    const range = selection.getRangeAt(0);

    // Check if we need to remove @ before inserting chip
    const startContainer = range.startContainer;
    if (startContainer.nodeType === Node.TEXT_NODE) {
      const textContent = startContainer.textContent || '';
      const offset = range.startOffset;
      if (offset > 0 && textContent[offset - 1] === '@') {
        // Remove the @ character
        const newText = textContent.slice(0, offset - 1) + textContent.slice(offset);
        startContainer.textContent = newText;
        range.setStart(startContainer, offset - 1);
        range.collapse(true);
      }
    }

    // Insert chip
    const chip = createChipElement(tabId, title);
    range.deleteContents();
    range.insertNode(chip);

    // Move cursor after chip
    range.setStartAfter(chip);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);

    insertedTabsRef.current.add(tabId);
  }, [createChipElement]);

  // Sync chips when selectedTabs prop changes (new tab selected via picker)
  useEffect(() => {
    const newTabs = selectedTabs.filter(tab => !insertedTabsRef.current.has(tab.id));
    for (const tab of newTabs) {
      insertChipAtCursor(tab.id, tab.title);
    }
  }, [selectedTabs, insertChipAtCursor]);

  // Handle backspace to remove chips
  const handleKeyDown = (e: KeyboardEvent) => {
    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
      return;
    }

    // Handle backspace for chip removal
    if (e.key === 'Backspace') {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      const range = selection.getRangeAt(0);
      if (!range.collapsed) return; // Selection exists, let browser handle

      const container = inputRef.current;
      if (!container) return;

      // Check if cursor is at the start of a text node that follows a chip
      const startContainer = range.startContainer;
      if (startContainer.nodeType === Node.TEXT_NODE && range.startOffset === 0) {
        const prevSibling = startContainer.previousSibling;
        if (prevSibling instanceof HTMLElement && prevSibling.hasAttribute('data-tab-id')) {
          e.preventDefault();
          const tabId = parseInt(prevSibling.getAttribute('data-tab-id') || '0', 10);
          prevSibling.remove();
          insertedTabsRef.current.delete(tabId);
          onRemoveTab(tabId);
          return;
        }
      }

      // Check if cursor is in the container directly and previous sibling is chip
      if (startContainer === container && range.startOffset > 0) {
        const childNodes = Array.from(container.childNodes);
        const prevNode = childNodes[range.startOffset - 1];
        if (prevNode instanceof HTMLElement && prevNode.hasAttribute('data-tab-id')) {
          e.preventDefault();
          const tabId = parseInt(prevNode.getAttribute('data-tab-id') || '0', 10);
          prevNode.remove();
          insertedTabsRef.current.delete(tabId);
          onRemoveTab(tabId);
          return;
        }
      }
    }
  };

  // Handle input to detect @ trigger
  const handleInput = () => {
    const container = inputRef.current;
    if (!container || !onTriggerTabPicker) return;

    // Get current text content at cursor position
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const startContainer = range.startContainer;

    // Check if cursor is in a text node and previous character is @
    if (startContainer.nodeType === Node.TEXT_NODE) {
      const textContent = startContainer.textContent || '';
      const offset = range.startOffset;
      if (offset > 0 && textContent[offset - 1] === '@') {
        onTriggerTabPicker();
      }
    }
  };

  // Handle send
  const handleSend = () => {
    const { text, tabIds } = extractContent();
    if (!text && tabIds.length === 0) return;

    onSend(text, tabIds);

    // Clear input
    if (inputRef.current) {
      inputRef.current.innerHTML = '';
      insertedTabsRef.current.clear();
    }
  };

  // Check if input has content (for button disabled state)
  const hasContent = () => {
    const container = inputRef.current;
    if (!container) return false;
    return container.textContent?.trim() || container.querySelector('[data-tab-id]');
  };

  return (
    <div className="p-4 bg-white border-t border-gray-200">
      <div className="flex gap-2">
        <div
          ref={inputRef}
          contentEditable={!disabled}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg min-h-[38px] max-h-[150px] overflow-y-auto focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400"
          data-placeholder="Type a message... (@ to add tabs)"
          role="textbox"
          aria-label="Message input"
          aria-multiline="true"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={disabled}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-300 disabled:cursor-not-allowed self-end"
        >
          Send
        </button>
      </div>
    </div>
  );
}
