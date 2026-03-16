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

const BLAST_TOKENS = [
  '{{customer_name}}',
  '{{display_name}}',
  '{{store_name}}'
];

function BlastEmailTab({ recipientSelection, onEditRecipients, disabled = false }) {
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
    ? 'all customers'
    : `${recipientSelection?.recipientIds?.length || 0} selected customer(s)`;

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
      setMessage({ tone: 'warning', content: 'Subject and body are required' });
      return;
    }
    try {
      setSavingDraft(true);
      if (editingDraftId) {
        await blastEmailAPI.update(editingDraftId, buildPayload(true));
        setMessage({ tone: 'success', content: 'Draft updated' });
      } else {
        await blastEmailAPI.create(buildPayload(true));
        setMessage({ tone: 'success', content: 'Draft saved' });
      }
      resetCompose();
      loadHistory();
    } catch (err) {
      setMessage({ tone: 'critical', content: err.response?.data?.error || err.message || 'Failed to save draft' });
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSendNow = async () => {
    if (!subject.trim() || !body.trim()) {
      setMessage({ tone: 'warning', content: 'Subject and body are required' });
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
      setMessage({ tone: 'success', content: 'Blast email sending started!' });
      resetCompose();
      loadHistory();
    } catch (err) {
      setMessage({ tone: 'critical', content: err.response?.data?.error || err.message || 'Failed to send' });
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
      setMessage({ tone: 'critical', content: 'Failed to load draft' });
    }
  };

  const handleDeleteDraft = async (id) => {
    try {
      await blastEmailAPI.delete(id);
      setMessage({ tone: 'success', content: 'Draft deleted' });
      loadHistory();
    } catch (err) {
      setMessage({ tone: 'critical', content: 'Failed to delete draft' });
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
      setMessage({ tone: 'critical', content: 'Failed to load blast details' });
    }
  };

  const handleTokenClick = (token) => {
    if (disabled) return;
    setBody(prev => prev + token);
  };

  const statusBadge = (status) => {
    const map = {
      draft: { tone: 'info', label: 'Draft' },
      sending: { tone: 'attention', label: 'Sending' },
      completed: { tone: 'success', label: 'Completed' },
      failed: { tone: 'critical', label: 'Failed' }
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
        <Banner tone="warning" title="Upgrade Required">
          <p>Blast emails are available on Pro plans and above.</p>
        </Banner>
      )}

      {/* ── Compose Section ── */}
      <Card sectioned>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Text variant="headingMd">
                {editingDraftId ? 'Edit Draft' : 'Compose Blast Email'}
              </Text>
              <Text tone="subdued">
                Sending to {recipientLabel}
                {' '}
                <Button size="slim" plain onClick={onEditRecipients}>
                  Edit recipients
                </Button>
              </Text>
            </div>
            {editingDraftId && (
              <Button size="slim" onClick={resetCompose}>Cancel editing</Button>
            )}
          </div>

          <TextField
            label="Subject"
            value={subject}
            onChange={setSubject}
            maxLength={200}
            showCharacterCount
            autoComplete="off"
            disabled={disabled}
          />

          {/* Editor mode toggle */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Text variant="bodySm" fontWeight="bold">Editor Mode</Text>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                size="slim"
                primary={editorMode === 'rich'}
                pressed={editorMode === 'rich'}
                onClick={() => setEditorMode('rich')}
                disabled={disabled}
              >
                Rich Editor
              </Button>
              <Button
                size="slim"
                primary={editorMode === 'html'}
                pressed={editorMode === 'html'}
                onClick={() => setEditorMode('html')}
                disabled={disabled}
              >
                HTML
              </Button>
            </div>
          </div>

          {editorMode === 'html' ? (
            <TextField
              label="HTML Body"
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
              placeholder="Compose your blast email..."
            />
          )}

          {/* Tokens */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Text variant="bodySm" fontWeight="bold">Available Tokens</Text>
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
            <Text variant="bodySm" fontWeight="bold">Delivery Mode</Text>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                size="slim"
                primary={deliveryMode === 'all'}
                pressed={deliveryMode === 'all'}
                onClick={() => setDeliveryMode('all')}
                disabled={disabled}
              >
                Send All
              </Button>
              <Button
                size="slim"
                primary={deliveryMode === 'trickle'}
                pressed={deliveryMode === 'trickle'}
                onClick={() => setDeliveryMode('trickle')}
                disabled={disabled}
              >
                Trickle
              </Button>
            </div>
          </div>

          {deliveryMode === 'trickle' && (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 120 }}>
                <TextField
                  label="Batch Size"
                  type="number"
                  value={batchSize}
                  onChange={setBatchSize}
                  min={1}
                  max={500}
                  autoComplete="off"
                  disabled={disabled}
                  helpText="1\u2013500 emails per batch"
                />
              </div>
              <div style={{ flex: 1, minWidth: 120 }}>
                <TextField
                  label="Interval (minutes)"
                  type="number"
                  value={intervalMinutes}
                  onChange={setIntervalMinutes}
                  min={1}
                  max={60}
                  autoComplete="off"
                  disabled={disabled}
                  helpText="1\u201360 minutes between batches"
                />
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <Button onClick={handleSaveDraft} loading={savingDraft} disabled={disabled}>
              Save as Draft
            </Button>
            <Button primary onClick={handleSendNow} loading={sending} disabled={disabled}>
              Send Now
            </Button>
          </div>
        </div>
      </Card>

      {/* ── Confirm Send Modal ── */}
      <Modal
        open={confirmSend}
        onClose={() => setConfirmSend(false)}
        title="Confirm Send"
        primaryAction={{
          content: 'Send',
          onAction: handleConfirmSend,
          loading: sending
        }}
        secondaryActions={[{
          content: 'Cancel',
          onAction: () => setConfirmSend(false)
        }]}
      >
        <Modal.Section>
          <Text>
            Send this email to {recipientLabel}?
            {deliveryMode === 'trickle' && ` (Trickle: ${batchSize} per batch, every ${intervalMinutes} min)`}
          </Text>
        </Modal.Section>
      </Modal>

      {/* ── History Section ── */}
      <Card sectioned>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Text variant="headingMd">Blast History</Text>

          {historyLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <Spinner />
            </div>
          ) : blasts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Text tone="subdued">No blast emails yet</Text>
            </div>
          ) : (
            <>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--p-color-border-subdued, #dfe3e8)' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left' }}><Text variant="headingSm">Subject</Text></th>
                    <th style={{ padding: '8px 12px', textAlign: 'left' }}><Text variant="headingSm">Date</Text></th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}><Text variant="headingSm">Recipients</Text></th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}><Text variant="headingSm">Status</Text></th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}><Text variant="headingSm">Progress</Text></th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}><Text variant="headingSm">Actions</Text></th>
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
                                <Button size="slim" onClick={() => handleEditDraft(blast)}>Edit</Button>
                                <Button size="slim" tone="critical" onClick={() => handleDeleteDraft(blast._id)}>Delete</Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                      {expandedBlastId === blast._id && expandedBlast && (
                        <tr key={`${blast._id}-detail`}>
                          <td colSpan={6} style={{ padding: '12px 24px', background: 'var(--p-color-bg-subdued, #f6f6f7)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                              <Text variant="headingSm">Email Preview</Text>
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
                                Recipients ({expandedBlast.recipients?.length || 0})
                              </Text>
                              <div style={{ maxHeight: 200, overflow: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                  <thead>
                                    <tr>
                                      <th style={{ padding: '4px 8px', textAlign: 'left' }}>Email</th>
                                      <th style={{ padding: '4px 8px', textAlign: 'left' }}>Name</th>
                                      <th style={{ padding: '4px 8px', textAlign: 'center' }}>Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(expandedBlast.recipients || []).slice(0, 50).map((r, i) => (
                                      <tr key={i} style={{ borderTop: '1px solid #eee' }}>
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
                                    Showing first 50 of {expandedBlast.recipients.length} recipients
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
                    Previous
                  </Button>
                  <Text>Page {historyPage} of {historyPages}</Text>
                  <Button size="slim" disabled={historyPage >= historyPages} onClick={() => setHistoryPage(p => p + 1)}>
                    Next
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
