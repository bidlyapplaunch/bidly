import { useCallback, useMemo } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

const TOOLBAR_OPTIONS = [
  [{ header: [1, 2, 3, false] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ color: [] }, { background: [] }],
  [{ align: [] }],
  [{ list: 'ordered' }, { list: 'bullet' }],
  ['link', 'image'],
  ['clean']
];

function RichTextEditor({ value, onChange, disabled = false, placeholder = '' }) {
  const modules = useMemo(() => ({
    toolbar: disabled ? false : TOOLBAR_OPTIONS
  }), [disabled]);

  const handleChange = useCallback((content) => {
    if (onChange) {
      onChange(content);
    }
  }, [onChange]);

  return (
    <div style={{ opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto' }}>
      <ReactQuill
        theme="snow"
        value={value || ''}
        onChange={handleChange}
        modules={modules}
        placeholder={placeholder}
        readOnly={disabled}
        style={{ minHeight: 200 }}
      />
    </div>
  );
}

export default RichTextEditor;
