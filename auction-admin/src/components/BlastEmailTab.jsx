import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Card,
  Text,
  TextField,
  Button,
  Spinner,
  Banner,
  Badge,
  Modal
} from '@shopify/polaris';
import DOMPurify from 'dompurify';
import RichTextEditor from './RichTextEditor';
import { blastEmailAPI } from '../services/blastEmailApi';
import useAdminI18n from '../hooks/useAdminI18n';

const BLAST_TOKENS = [
  '{{customer_name}}',
  '{{display_name}}',
  '{{store_name}}'
];

function BlastEmailTab({ recipientSelection, onEditRecipients, disabled = false }) {
  const i18n = useAdminI18n();
  // ── Compose state ──
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [editorMode, setEditorMode] = useState('rich');
  const [deliveryMode, setDeliveryMode] = useState('all');
  const [batchSize, setBatchSize] = useState('50');
  const [intervalMinutes, setIntervalMinutes] = useState('5');
  const [sending, setSending] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [editingDraftId, setEditingDraftId] = useState(null);

  // ── History state ──
  const [blasts, setBlasts] = useState([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [expandedBlastId, setExpandedBlastId] = useState(null);
  const [expandedBlast, setExpandedBlast] = useState(null);

  // ── UI state ──
  const [message, setMessage] = useState(null);
  const [confirmSend, setConfirmSend] = useState(false);
  const pollingRef = useRef(null);

  // ── Load history ──
  const loadHistory = useCallback(async () => {
    try {
      setHistoryLoading(true);
      const data = await blastEmailAPI.list({ page: historyPage, limit: 10 });
      setBlasts(data.blasts);
      setHistoryTotal(data.total);
    } catch (err) {
      console.error('Failed to load blast history:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, [historyPage]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // ── Poll sending blasts for progress ──
  useEffect(() => {
    const sendingBlasts = blasts.filter(b => b.status === 'sending');
    if (sendingBlasts.length === 0) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    pollingRef.current = setInterval(async () => {
      let changed = false;
      for (const blast of sendingBlasts) {
        try {
          const progress = await blastEmailAPI.getProgress(blast._id);
          if (progress.status !== blast.status || progress.stats.sent !== blast.stats.sent) {
            changed = true;
          }
        } catch (err) {
          // ignore
        }
      }
      if (changed) loadHistory();
    }, 10000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [blasts, loadHistory]);

  // ── Recipient count display ──
  const recipientLabel = recipientSelection?.selectAll
    ? i18n.translate('admin.mail_service.blast.recipientsAll')
    : i18n.translate('admin.mail_service.blast.recipientsSelected', {
        count: recipientSelection?.recipientIds?.length || 0
      });

  // ── Handlers ──
  const resetCompose = () => {
    setSubject('');
    setBody('');
    setDeliveryMode('all');
    setBatchSize('50');
    setIntervalMinutes('5');
    setEditingDraftId(null);
  };

  const buildPayload = (saveAsDraft) => ({
    subject,
    body,
    deliveryMode,
    trickleConfig: deliveryMode === 'trickle' ? {
      batchSize: parseInt(batchSize) || 50,
      intervalMinutes: parseInt(intervalMinutes) || 5
    } : undefined,
    selectAll: recipientSelection?.selectAll ?? true,
    recipientIds: recipientSelection?.recipientIds || [],
    saveAsDraft
  });

  const handleSaveDraft = async () => {
    if (!subject.trim() || !body.trim()) {
      setMessage({ tone: 'warning', content: i18n.translate('admin.mail_service.blast.messages.subjectBodyRequired') });
      return;
    }
    try {
      setSavingDraft(true);
      if (editingDraftId) {
        await blastEmailAPI.update(editingDraftId, buildPayload(true));
        setMessage({ tone: 'success', content: i18n.translate('admin.mail_service.blast.messages.draftUpdated') });
      } else {
        await blastEmailAPI.create(buildPayload(true));
        setMessage({ tone: 'success', content: i18n.translate('admin.mail_service.blast.messages.draftSaved') });
      }
      resetCompose();
      loadHistory();
    } catch (err) {
      setMessage({ tone: 'critical', content: err.response?.data?.error || err.message || i18n.translate('admin.mail_service.blast.messages.saveDraftError') });
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSendNow = async () => {
    if (!subject.trim() || !body.trim()) {
      setMessage({ tone: 'warning', content: i18n.translate('admin.mail_service.blast.messages.subjectBodyRequired') });
      return;
    }
    setConfirmSend(true);
  };

  const handleConfirmSend = async () => {
    setConfirmSend(false);
    try {
      setSending(true);
      if (editingDraftId) {
        await blastEmailAPI.update(editingDraftId, buildPayload(true));
        await blastEmailAPI.send(editingDraftId);
      } else {
        await blastEmailAPI.create(buildPayload(false));
      }
      setMessage({ tone: 'success', content: i18n.translate('admin.mail_service.blast.messages.sendStarted') });
      resetCompose();
      loadHistory();
    } catch (err) {
      setMessage({ tone: 'critical', content: err.response?.data?.error || err.message || i18n.translate('admin.mail_service.blast.messages.sendError') });
    } finally {
      setSending(false);
    }
  };

  const handleEditDraft = async (blast) => {
    try {
      const data = await blastEmailAPI.get(blast._id);
      const full = data.blast;
      setSubject(full.subject);
      setBody(full.body);
      setDeliveryMode(full.deliveryMode || 'all');
      setBatchSize(String(full.trickleConfig?.batchSize || 50));
      setIntervalMinutes(String(full.trickleConfig?.intervalMinutes || 5));
      setEditingDraftId(full._id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setMessage({ tone: 'critical', content: i18n.translate('admin.mail_service.blast.messages.loadDraftError') });
    }
  };

  const handleDeleteDraft = async (id) => {
    try {
      await blastEmailAPI.delete(id);
      setMessage({ tone: 'success', content: i18n.translate('admin.mail_service.blast.messages.draftDeleted') });
      loadHistory();
    } catch (err) {
      setMessage({ tone: 'critical', content: i18n.translate('admin.mail_service.blast.messages.deleteDraftError') });
    }
  };

  const handleExpandBlast = async (id) => {
    if (expandedBlastId === id) {
      setExpandedBlastId(null);
      setExpandedBlast(null);
      return;
    }
    try {
      const data = await blastEmailAPI.get(id);
      setExpandedBlast(data.blast);
      setExpandedBlastId(id);
    } catch (err) {
      setMessage({ tone: 'critical', content: i18n.translate('admin.mail_service.blast.messages.loadDetailsError') });
    }
  };

  const handleTokenClick = (token) => {
    if (disabled) return;
    setBody(prev => prev + token);
  };

  const statusBadge = (status) => {
    const map = {
      draft: { tone: 'info', label: i18n.translate('admin.mail_service.blast.statusBadge.draft') },
      sending: { tone: 'attention', label: i18n.translate('admin.mail_service.blast.statusBadge.sending') },
      completed: { tone: 'success', label: i18n.translate('admin.mail_service.blast.statusBadge.completed') },
      failed: { tone: 'critical', label: i18n.translate('admin.mail_service.blast.statusBadge.failed') }
    };
    const config = map[status] || { tone: 'info', label: status };
    return <Badge tone={config.tone}>{config.label}</Badge>;
  };

  const historyPages = Math.ceil(historyTotal / 10);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {message && (
        <Banner tone={message.tone} onDismiss={() => setMessage(null)}>
          <p>{message.content}</p>
        </Banner>
      )}

      {disabled && (
        <Banner tone="warning" title={i18n.translate('admin.mail_service.blast.upgradeTitle')}>
          <p>{i18n.translate('admin.mail_service.blast.upgradeDescription')}</p>
        </Banner>
      )}

      {/* ── Compose Section ── */}
      <Card sectioned>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Text variant="headingMd">
                {editingDraftId
                  ? i18n.translate('admin.mail_service.blast.editTitle')
                  : i18n.translate('admin.mail_service.blast.composeTitle')}
              </Text>
              <Text tone="subdued">
                {i18n.translate('admin.mail_service.blast.sendingTo', { recipients: recipientLabel })}
                {' '}
                <Button size="slim" plain onClick={onEditRecipients}>
                  {i18n.translate('admin.mail_service.blast.editRecipients')}
                </Button>
              </Text>
            </div>
            {editingDraftId && (
              <Button size="slim" onClick={resetCompose}>{i18n.translate('admin.mail_service.blast.cancelEditing')}</Button>
            )}
          </div>

          <TextField
            label={i18n.translate('admin.mail_service.blast.subject')}
            value={subject}
            onChange={setSubject}
            maxLength={200}
            showCharacterCount
            autoComplete="off"
            disabled={disabled}
          />

          {/* Editor mode toggle */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Text variant="bodySm" fontWeight="bold">{i18n.translate('admin.mail_service.blast.editorMode')}</Text>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                size="slim"
                primary={editorMode === 'rich'}
                pressed={editorMode === 'rich'}
                onClick={() => setEditorMode('rich')}
                disabled={disabled}
              >
                {i18n.translate('admin.mail_service.blast.richEditor')}
              </Button>
              <Button
                size="slim"
                primary={editorMode === 'html'}
                pressed={editorMode === 'html'}
                onClick={() => setEditorMode('html')}
                disabled={disabled}
              >
                {i18n.translate('admin.mail_service.blast.htmlEditor')}
              </Button>
            </div>
          </div>

          {editorMode === 'html' ? (
            <TextField
              label={i18n.translate('admin.mail_service.blast.htmlBody')}
              value={body}
              onChange={setBody}
              multiline={10}
              autoComplete="off"
              disabled={disabled}
              monospaced
            />
          ) : (
            <RichTextEditor
              value={body}
              onChange={setBody}
              disabled={disabled}
              placeholder={i18n.translate('admin.mail_service.blast.composePlaceholder')}
            />
          )}

          {/* Tokens */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Text variant="bodySm" fontWeight="bold">{i18n.translate('admin.mail_service.blast.availableTokens')}</Text>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {BLAST_TOKENS.map(token => (
                <code
                  key={token}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 6,
                    background: 'var(--p-color-bg-subdued)',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    fontSize: 12
                  }}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleTokenClick(token)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleTokenClick(token);
                    }
                  }}
                >
                  {token}
                </code>
              ))}
            </div>
          </div>

          {/* Delivery mode */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Text variant="bodySm" fontWeight="bold">{i18n.translate('admin.mail_service.blast.deliveryMode')}</Text>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                size="slim"
                primary={deliveryMode === 'all'}
                pressed={deliveryMode === 'all'}
                onClick={() => setDeliveryMode('all')}
                disabled={disabled}
              >
                {i18n.translate('admin.mail_service.blast.sendAll')}
              </Button>
              <Button
                size="slim"
                primary={deliveryMode === 'trickle'}
                pressed={deliveryMode === 'trickle'}
                onClick={() => setDeliveryMode('trickle')}
                disabled={disabled}
              >
                {i18n.translate('admin.mail_service.blast.trickle')}
              </Button>
            </div>
          </div>

          {deliveryMode === 'trickle' && (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 120 }}>
                <TextField
                  label={i18n.translate('admin.mail_service.blast.batchSize')}
                  type="number"
                  value={batchSize}
                  onChange={setBatchSize}
                  min={1}
                  max={500}
                  autoComplete="off"
                  disabled={disabled}
                  helpText={i18n.translate('admin.mail_service.blast.batchHelp')}
                />
              </div>
              <div style={{ flex: 1, minWidth: 120 }}>
                <TextField
                  label={i18n.translate('admin.mail_service.blast.intervalLabel')}
                  type="number"
                  value={intervalMinutes}
                  onChange={setIntervalMinutes}
                  min={1}
                  max={60}
                  autoComplete="off"
                  disabled={disabled}
                  helpText={i18n.translate('admin.mail_service.blast.intervalHelp')}
                />
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <Button onClick={handleSaveDraft} loading={savingDraft} disabled={disabled}>
              {i18n.translate('admin.mail_service.blast.saveDraft')}
            </Button>
            <Button primary onClick={handleSendNow} loading={sending} disabled={disabled}>
              {i18n.translate('admin.mail_service.blast.sendNow')}
            </Button>
          </div>
        </div>
      </Card>

      {/* ── Confirm Send Modal ── */}
      <Modal
        open={confirmSend}
        onClose={() => setConfirmSend(false)}
        title={i18n.translate('admin.mail_service.blast.confirmTitle')}
        primaryAction={{
          content: i18n.translate('admin.mail_service.blast.confirmSend'),
          onAction: handleConfirmSend,
          loading: sending
        }}
        secondaryActions={[{
          content: i18n.translate('admin.common.cancel'),
          onAction: () => setConfirmSend(false)
        }]}
      >
        <Modal.Section>
          <Text>
            {i18n.translate('admin.mail_service.blast.confirmBody', { recipients: recipientLabel })}
            {deliveryMode === 'trickle' && i18n.translate('admin.mail_service.blast.confirmTrickle', { batchSize, interval: intervalMinutes })}
          </Text>
        </Modal.Section>
      </Modal>

      {/* ── History Section ── */}
      <Card sectioned>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Text variant="headingMd">{i18n.translate('admin.mail_service.blast.history')}</Text>

          {historyLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <Spinner />
            </div>
          ) : blasts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Text tone="subdued">{i18n.translate('admin.mail_service.blast.historyEmpty')}</Text>
            </div>
          ) : (
            <>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--p-color-border-subdued, #dfe3e8)' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left' }}><Text variant="headingSm">{i18n.translate('admin.mail_service.blast.columns.subject')}</Text></th>
                    <th style={{ padding: '8px 12px', textAlign: 'left' }}><Text variant="headingSm">{i18n.translate('admin.mail_service.blast.columns.date')}</Text></th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}><Text variant="headingSm">{i18n.translate('admin.mail_service.blast.columns.recipients')}</Text></th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}><Text variant="headingSm">{i18n.translate('admin.mail_service.blast.columns.status')}</Text></th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}><Text variant="headingSm">{i18n.translate('admin.mail_service.blast.columns.progress')}</Text></th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}><Text variant="headingSm">{i18n.translate('admin.mail_service.blast.columns.actions')}</Text></th>
                  </tr>
                </thead>
                <tbody>
                  {blasts.map((blast) => (
                    <React.Fragment key={blast._id}>
                      <tr
                        style={{
                          borderBottom: '1px solid var(--p-color-border-subdued, #dfe3e8)',
                          cursor: 'pointer'
                        }}
                        onClick={() => handleExpandBlast(blast._id)}
                      >
                        <td style={{ padding: '8px 12px' }}>
                          <Text>{blast.subject}</Text>
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <Text tone="subdued">
                            {new Date(blast.sentAt || blast.createdAt).toLocaleDateString()}
                          </Text>
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          <Text>{blast.stats?.total || 0}</Text>
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          {statusBadge(blast.status)}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          {blast.status === 'sending' ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                              <div style={{
                                width: 80,
                                height: 8,
                                background: 'var(--p-color-bg-subdued)',
                                borderRadius: 4,
                                overflow: 'hidden'
                              }}>
                                <div style={{
                                  width: `${blast.stats?.total ? (blast.stats.sent / blast.stats.total * 100) : 0}%`,
                                  height: '100%',
                                  background: 'var(--p-color-bg-fill-success)',
                                  borderRadius: 4,
                                  transition: 'width 0.3s'
                                }} />
                              </div>
                              <Text variant="bodySm">{blast.stats?.sent || 0}/{blast.stats?.total || 0}</Text>
                            </div>
                          ) : (
                            <Text variant="bodySm">
                              {blast.stats?.sent || 0}/{blast.stats?.total || 0}
                            </Text>
                          )}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                            {blast.status === 'draft' && (
                              <>
                                <Button size="slim" onClick={() => handleEditDraft(blast)}>{i18n.translate('admin.mail_service.blast.rowActions.edit')}</Button>
                                <Button size="slim" tone="critical" onClick={() => handleDeleteDraft(blast._id)}>{i18n.translate('admin.mail_service.blast.rowActions.delete')}</Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                      {expandedBlastId === blast._id && expandedBlast && (
                        <tr key={`${blast._id}-detail`}>
                          <td colSpan={6} style={{ padding: '12px 24px', background: 'var(--p-color-bg-subdued, #f6f6f7)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                              <Text variant="headingSm">{i18n.translate('admin.mail_service.blast.preview')}</Text>
                              <div
                                style={{
                                  background: '#fff',
                                  padding: 16,
                                  borderRadius: 8,
                                  border: '1px solid var(--p-color-border-subdued)',
                                  maxHeight: 300,
                                  overflow: 'auto'
                                }}
                                dangerouslySetInnerHTML={{
                                  __html: DOMPurify.sanitize(expandedBlast.body)
                                }}
                              />
                              <Text variant="headingSm">
                                {i18n.translate('admin.mail_service.blast.recipientsCount', { count: expandedBlast.recipients?.length || 0 })}
                              </Text>
                              <div style={{ maxHeight: 200, overflow: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                  <thead>
                                    <tr>
                                      <th style={{ padding: '4px 8px', textAlign: 'left' }}>{i18n.translate('admin.mail_service.blast.recipientEmail')}</th>
                                      <th style={{ padding: '4px 8px', textAlign: 'left' }}>{i18n.translate('admin.mail_service.blast.recipientName')}</th>
                                      <th style={{ padding: '4px 8px', textAlign: 'center' }}>{i18n.translate('admin.mail_service.blast.recipientStatus')}</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(expandedBlast.recipients || []).slice(0, 50).map((r) => (
                                      <tr key={r.email} style={{ borderTop: '1px solid #eee' }}>
                                        <td style={{ padding: '4px 8px' }}>{r.email}</td>
                                        <td style={{ padding: '4px 8px' }}>{r.displayName}</td>
                                        <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                                          {statusBadge(r.status)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                {(expandedBlast.recipients?.length || 0) > 50 && (
                                  <Text tone="subdued" variant="bodySm">
                                    {i18n.translate('admin.mail_service.blast.showingFirst', { total: expandedBlast.recipients.length })}
                                  </Text>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>

              {historyPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, paddingTop: 8 }}>
                  <Button size="slim" disabled={historyPage <= 1} onClick={() => setHistoryPage(p => p - 1)}>
                    {i18n.translate('admin.mail_service.customers.pagination.previous')}
                  </Button>
                  <Text>{i18n.translate('admin.mail_service.customers.pagination.page', { current: historyPage, total: historyPages })}</Text>
                  <Button size="slim" disabled={historyPage >= historyPages} onClick={() => setHistoryPage(p => p + 1)}>
                    {i18n.translate('admin.mail_service.customers.pagination.next')}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

export default BlastEmailTab;
