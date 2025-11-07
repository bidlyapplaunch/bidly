import { useCallback, useEffect, useMemo, useState } from 'react';
import { customizationSettingsAPI } from '../services/api';

const EMPTY_SETTINGS = {
  template: 'A',
  font: 'Inter',
  colors: {
    accent: '#2563eb',
    text: '#0f172a',
    bg_solid: '#ffffff',
    bg_gradient_start: '#ffffff',
    bg_gradient_end: '#ffffff',
    button_bg: '#2563eb',
    button_hover: '#1d4ed8',
    button_text: '#ffffff',
    border: '#e5e7eb'
  },
  borderRadius: 8,
  boxShadow: 'subtle',
  gradientEnabled: false
};

export function useCustomizationSettings(type) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState(EMPTY_SETTINGS);
  const [originalSettings, setOriginalSettings] = useState(EMPTY_SETTINGS);
  const [meta, setMeta] = useState(null);
  const [previewState, setPreviewState] = useState('active');
  const [previewData, setPreviewData] = useState(null);
  const [toast, setToast] = useState(null);

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await customizationSettingsAPI.getSettings(type, { includeMeta: true });
      if (response.success) {
        setSettings(response.settings);
        setOriginalSettings(response.settings);
        setMeta(response.meta);
      } else {
        setError(response.message || 'Failed to load customization settings');
      }
    } catch (err) {
      console.error(`Error loading ${type} customization`, err);
      setError(err.message || `Failed to load ${type} customization`);
    } finally {
      setLoading(false);
    }
  }, [type]);

  const loadPreview = useCallback(
    async (state = previewState) => {
      try {
        const response = await customizationSettingsAPI.getPreview(type, state);
        if (response.success) {
          setPreviewData(response.preview);
          setPreviewState(state);
        }
      } catch (err) {
        console.error(`Error loading preview for ${type}`, err);
      }
    },
    [type, previewState]
  );

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (meta) {
      loadPreview('active');
    }
  }, [meta, loadPreview]);

  const updateSettings = useCallback((updater) => {
    setSettings((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      return {
        ...prev,
        ...next,
        colors: {
          ...prev.colors,
          ...(next.colors || {})
        }
      };
    });
  }, []);

  const applyTemplate = useCallback(
    (templateId) => {
      if (!meta) return;
      const template = meta.templates?.find((tpl) => tpl.id === templateId);
      if (!template) return;
      updateSettings({
        template: templateId,
        font: template.font,
        colors: template.colors,
        borderRadius: template.borderRadius,
        boxShadow: template.boxShadow,
        gradientEnabled: template.gradientEnabled
      });
    },
    [meta, updateSettings]
  );

  const applyPalette = useCallback(
    (paletteId) => {
      if (!meta) return;
      const palette = meta.palettes?.find((item) => item.id === paletteId);
      if (!palette) return;

      updateSettings((prev) => ({
        colors: {
          ...prev.colors,
          ...palette.colors
        }
      }));
    },
    [meta, updateSettings]
  );

  const updateColor = useCallback(
    (key, value) => {
      if (!value?.startsWith('#')) {
        return;
      }
      updateSettings((prev) => ({
        colors: {
          ...prev.colors,
          [key]: value
        }
      }));
    },
    [updateSettings]
  );

  const updateField = useCallback(
    (field, value) => {
      updateSettings({
        [field]: value
      });
    },
    [updateSettings]
  );

  const toggleGradient = useCallback(() => {
    updateSettings((prev) => ({
      gradientEnabled: !prev.gradientEnabled
    }));
  }, [updateSettings]);

  const resetToDefaults = useCallback(() => {
    if (!meta?.templates) {
      setSettings(EMPTY_SETTINGS);
      return;
    }
    const defaultTemplate = meta.templates.find((tpl) => tpl.id === 'A') || meta.templates[0];
    applyTemplate(defaultTemplate.id);
  }, [meta, applyTemplate]);

  const resetToOriginal = useCallback(() => {
    setSettings(originalSettings);
  }, [originalSettings]);

  const save = useCallback(async () => {
    try {
      setSaving(true);
      setError('');
      const response = await customizationSettingsAPI.saveSettings(type, settings);
      if (response.success) {
        setOriginalSettings(response.settings);
        setSettings(response.settings);
        setToast({ status: 'success', message: 'Customization saved successfully' });
      } else {
        setError(response.message || 'Failed to save customization settings');
        setToast({ status: 'error', message: response.message || 'Failed to save customization settings' });
      }
    } catch (err) {
      console.error(`Error saving ${type} customization`, err);
      const message = err.response?.data?.message || err.message || 'Failed to save customization settings';
      setError(message);
      setToast({ status: 'error', message });
    } finally {
      setSaving(false);
    }
  }, [settings, type]);

  const dirty = useMemo(() => {
    return JSON.stringify(settings) !== JSON.stringify(originalSettings);
  }, [settings, originalSettings]);

  return {
    loading,
    saving,
    error,
    settings,
    originalSettings,
    meta,
    previewState,
    previewData,
    toast,
    setToast,
    dirty,
    updateField,
    updateColor,
    updateSettings,
    applyTemplate,
    applyPalette,
    toggleGradient,
    resetToDefaults,
    resetToOriginal,
    save,
    reload: loadSettings,
    loadPreview
  };
}

export default useCustomizationSettings;


