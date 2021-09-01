import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from 'react';
import ReactDOM from 'react-dom';
import {
  Editable,
  withReact,
  useSlate,
  Slate,
  useSlateStatic,
  useSelected,
  useFocused,
  ReactEditor,
} from 'slate-react';
import isHotkey from 'is-hotkey';
import isUrl from 'is-url';
import { withHistory } from 'slate-history';
import {
  Editor,
  Transforms,
  Range,
  Point,
  createEditor,
  Element as SlateElement,
  Node,
} from 'slate';
import imageExtensions from 'image-extensions';

const HOTKEYS = {
  'mod+b': 'bold',
  'mod+i': 'italic',
  'mod+u': 'underline',
  'mod+`': 'code',
};

const SHORTCUTS = {
  '*': 'list-item',
  '-': 'list-item',
  '+': 'list-item',
  '>': 'block-quote',
  '#': 'heading-one',
  '##': 'heading-two',
  '###': 'heading-three',
  '####': 'heading-four',
  '#####': 'heading-five',
  '######': 'heading-six',
};

const LIST_TYPES = ['numbered-list', 'bulleted-list'];

const RichTextExample = () => {
  const [value, setValue] = useState(initialValue);
  const renderElement = useCallback((props) => <Element {...props} />, []);
  const renderLeaf = useCallback((props) => <Leaf {...props} />, []);
  const editor = useMemo(
    () => withImages(withShortcuts(withReact(withHistory(createEditor())))),
    []
  );

  return (
    <Slate editor={editor} value={value} onChange={(value) => setValue(value)}>
      <div>
        <MarkButton format='bold' icon='format_bold' btnLabel='B' />
        <MarkButton format='italic' icon='format_italic' btnLabel='I' />
        <MarkButton format='underline' icon='format_underlined' btnLabel='_' />
        <MarkButton format='code' icon='code' btnLabel='<>' />
        <BlockButton format='heading-one' icon='looks_one' btnLabel='h1' />
        <BlockButton format='heading-two' icon='looks_two' btnLabel='h2' />
        <BlockButton format='block-quote' icon='format_quote' btnLabel='""' />
        <BlockButton
          format='numbered-list'
          icon='format_list_numbered'
          btnLabel='1.'
        />
        <BlockButton
          format='bulleted-list'
          icon='format_list_bulleted'
          btnLabel='*'
        />
        <InsertImageButton />
      </div>
      <Editable
        renderElement={renderElement}
        renderLeaf={renderLeaf}
        placeholder='Type something legendary...'
        spellCheck
        autoFocus
        onKeyDown={(event) => {
          for (const hotkey in HOTKEYS) {
            if (isHotkey(hotkey, event)) {
              event.preventDefault();
              const mark = HOTKEYS[hotkey];
              toggleMark(editor, mark);
            }
          }
        }}
      />
    </Slate>
  );
};

const toggleBlock = (editor, format) => {
  const isActive = isBlockActive(editor, format);
  const isList = LIST_TYPES.includes(format);

  Transforms.unwrapNodes(editor, {
    match: (n) =>
      LIST_TYPES.includes(
        !Editor.isEditor(n) && SlateElement.isElement(n) && n.type
      ),
    split: true,
  });
  const newProperties = {
    type: isActive ? 'paragraph' : isList ? 'list-item' : format,
  };
  Transforms.setNodes(editor, newProperties);

  if (!isActive && isList) {
    const block = { type: format, children: [] };
    Transforms.wrapNodes(editor, block);
  }
};

const toggleMark = (editor, format) => {
  const isActive = isMarkActive(editor, format);

  if (isActive) {
    Editor.removeMark(editor, format);
  } else {
    Editor.addMark(editor, format, true);
  }
};

const isBlockActive = (editor, format) => {
  const [match] = Editor.nodes(editor, {
    match: (n) =>
      !Editor.isEditor(n) && SlateElement.isElement(n) && n.type === format,
  });

  return !!match;
};

const isMarkActive = (editor, format) => {
  const marks = Editor.marks(editor);
  return marks ? marks[format] === true : false;
};

const Element = (props) => {
  const { attributes, children, element } = props;
  switch (element.type) {
    case 'block-quote':
      return <blockquote {...attributes}>{children}</blockquote>;
    case 'bulleted-list':
      return <ul {...attributes}>{children}</ul>;
    case 'heading-one':
      return <h1 {...attributes}>{children}</h1>;
    case 'heading-two':
      return <h2 {...attributes}>{children}</h2>;
    case 'heading-three':
      return <h3 {...attributes}>{children}</h3>;
    case 'heading-four':
      return <h4 {...attributes}>{children}</h4>;
    case 'heading-five':
      return <h5 {...attributes}>{children}</h5>;
    case 'heading-six':
      return <h6 {...attributes}>{children}</h6>;
    case 'list-item':
      return <li {...attributes}>{children}</li>;
    case 'numbered-list':
      return <ol {...attributes}>{children}</ol>;
    case 'image':
      return <Image {...props} />;
    default:
      return <p {...attributes}>{children}</p>;
  }
};

const Leaf = ({ attributes, children, leaf }) => {
  if (leaf.bold) {
    children = <strong>{children}</strong>;
  }

  if (leaf.code) {
    children = <code>{children}</code>;
  }

  if (leaf.italic) {
    children = <em>{children}</em>;
  }

  if (leaf.underline) {
    children = <u>{children}</u>;
  }

  return <span {...attributes}>{children}</span>;
};

const BlockButton = ({ format, icon, btnLabel }) => {
  const editor = useSlate();
  return (
    <button
      active={isBlockActive(editor, format)}
      onMouseDown={(event) => {
        event.preventDefault();
        toggleBlock(editor, format);
      }}
    >
      {btnLabel}
      {/* <Icon>{icon}</Icon> */}
    </button>
  );
};

const MarkButton = ({ format, icon, btnLabel }) => {
  const editor = useSlate();
  return (
    <button
      active={isMarkActive(editor, format)}
      onMouseDown={(event) => {
        event.preventDefault();
        toggleMark(editor, format);
      }}
    >
      {btnLabel}
      {/* <Icon>{icon}</Icon> */}
    </button>
  );
};

// markdown shortcut part starts <<
const withShortcuts = (editor) => {
  const { deleteBackward, insertText } = editor;

  editor.insertText = (text) => {
    const { selection } = editor;

    if (text === ' ' && selection && Range.isCollapsed(selection)) {
      const { anchor } = selection;
      const block = Editor.above(editor, {
        match: (n) => Editor.isBlock(editor, n),
      });
      const path = block ? block[1] : [];
      const start = Editor.start(editor, path);
      const range = { anchor, focus: start };
      const beforeText = Editor.string(editor, range);
      const type = SHORTCUTS[beforeText];

      if (type) {
        Transforms.select(editor, range);
        Transforms.delete(editor);
        const newProperties = {
          type,
        };
        Transforms.setNodes(editor, newProperties, {
          match: (n) => Editor.isBlock(editor, n),
        });

        if (type === 'list-item') {
          const list = {
            type: 'bulleted-list',
            children: [],
          };
          Transforms.wrapNodes(editor, list, {
            match: (n) =>
              !Editor.isEditor(n) &&
              SlateElement.isElement(n) &&
              n.type === 'list-item',
          });
        }

        return;
      }
    }

    insertText(text);
  };

  editor.deleteBackward = (...args) => {
    const { selection } = editor;

    if (selection && Range.isCollapsed(selection)) {
      const match = Editor.above(editor, {
        match: (n) => Editor.isBlock(editor, n),
      });

      if (match) {
        const [block, path] = match;
        const start = Editor.start(editor, path);

        if (
          !Editor.isEditor(block) &&
          SlateElement.isElement(block) &&
          block.type !== 'paragraph' &&
          Point.equals(selection.anchor, start)
        ) {
          const newProperties = {
            type: 'paragraph',
          };
          Transforms.setNodes(editor, newProperties);

          if (block.type === 'list-item') {
            Transforms.unwrapNodes(editor, {
              match: (n) =>
                !Editor.isEditor(n) &&
                SlateElement.isElement(n) &&
                n.type === 'bulleted-list',
              split: true,
            });
          }

          return;
        }
      }

      deleteBackward(...args);
    }
  };

  return editor;
};

// markdown shortcut part ends <<

// image part starts <<
const withImages = (editor) => {
  const { insertData, isVoid } = editor;

  editor.isVoid = (element) => {
    return element.type === 'image' ? true : isVoid(element);
  };

  editor.insertData = (data) => {
    const text = data.getData('text/plain');
    const { files } = data;

    if (files && files.length > 0) {
      for (const file of files) {
        const reader = new FileReader();
        const [mime] = file.type.split('/');

        if (mime === 'image') {
          reader.addEventListener('load', () => {
            const url = reader.result;
            insertImage(editor, url);
          });

          reader.readAsDataURL(file);
        }
      }
    } else if (isImageUrl(text)) {
      insertImage(editor, text);
    } else {
      insertData(data);
    }
  };

  return editor;
};

const insertImage = (editor, url) => {
  const text = { text: '' };
  const image = [
    {
      type: 'image',
      url,
      children: [text],
    },
    {
      type: 'paragraph',
      children: [text],
    },
  ];

  Transforms.insertNodes(editor, image);
};

const Image = (props) => {
  const { attributes, children, element } = props;
  const selected = useSelected();
  const focused = useFocused();
  return (
    <div {...attributes}>
      <div contentEditable={false}>
        <img src={element.url} />
      </div>
      {children}
    </div>
  );
};

const InsertImageButton = () => {
  const editor = useSlateStatic();
  return (
    <button
      onMouseDown={(event) => {
        event.preventDefault();
        const url = window.prompt('Enter the URL of the image:');
        if (url && !isImageUrl(url)) {
          alert('URL is not an image');
          return;
        }
        insertImage(editor, url);
      }}
    >
      🎆
      {/* <Icon>image</Icon> */}
    </button>
  );
};

const isImageUrl = (url) => {
  if (!url) return false;
  if (!isUrl(url)) return false;
  const ext = new URL(url).pathname.split('.').pop();
  return imageExtensions.includes(ext);
};

// image part ends <<

const initialValue = [
  {
    type: 'paragraph',
    children: [{ text: '' }],
  },
];

export default RichTextExample;
