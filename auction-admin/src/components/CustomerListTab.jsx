import { useCallback, useEffect, useState } from 'react';
import {
  Card,
  Text,
  TextField,
  Button,
  Spinner,
  Banner,
  Badge
} from '@shopify/polaris';
import { emailSettingsAPI } from '../services/emailSettingsApi';
import useAdminI18n from '../hooks/useAdminI18n';

function CustomerListTab({ onComposeBlast }) {
  const i18n = useAdminI18n();
  const [customers, setCustomers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const limit = 25;

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadCustomers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await emailSettingsAPI.getCustomers({ page, limit, search: debouncedSearch });
      setCustomers(data.customers);
      setTotal(data.total);
    } catch (err) {
      setError(err.message || i18n.translate('admin.mail_service.customers.loadError'));
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, i18n]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const handleToggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setSelectAll(false);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllToggle = () => {
    if (selectAll) {
      setSelectedIds(new Set());
      setSelectAll(false);
    } else {
      setSelectedIds(new Set(customers.map(c => c._id)));
      setSelectAll(true);
    }
  };

  const handleCompose = () => {
    if (onComposeBlast) {
      if (selectAll && selectedIds.size === customers.length && total > customers.length) {
        onComposeBlast({ selectAll: true, recipientIds: [] });
      } else if (selectedIds.size > 0) {
        onComposeBlast({ selectAll: false, recipientIds: Array.from(selectedIds) });
      } else {
        onComposeBlast({ selectAll: true, recipientIds: [] });
      }
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {error && (
        <Banner tone="critical" onDismiss={() => setError(null)}>
          <p>{error}</p>
        </Banner>
      )}

      <Card sectioned>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <Text variant="headingMd">{i18n.translate('admin.mail_service.customers.heading')}</Text>
              <Text tone="subdued">
                {i18n.translate(
                  total === 1
                    ? 'admin.mail_service.customers.subtitleOne'
                    : 'admin.mail_service.customers.subtitleOther',
                  { count: total }
                )}
              </Text>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {selectedIds.size > 0 && (
                <Badge tone="info">
                  {i18n.translate('admin.mail_service.customers.selectedBadge', { count: selectedIds.size })}
                </Badge>
              )}
              <Button primary onClick={handleCompose}>
                {i18n.translate('admin.mail_service.customers.compose')}
              </Button>
            </div>
          </div>

          <TextField
            placeholder={i18n.translate('admin.mail_service.customers.searchPlaceholder')}
            value={search}
            onChange={setSearch}
            autoComplete="off"
            clearButton
            onClearButtonClick={() => setSearch('')}
          />

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <Spinner />
            </div>
          ) : customers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Text tone="subdued">{i18n.translate('admin.mail_service.customers.empty')}</Text>
            </div>
          ) : (
            <>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--p-color-border-subdued, #dfe3e8)' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', width: 40 }}>
                      <input
                        type="checkbox"
                        checked={selectAll}
                        onChange={handleSelectAllToggle}
                        style={{ cursor: 'pointer' }}
                      />
                    </th>
                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>
                      <Text variant="headingSm">{i18n.translate('admin.mail_service.customers.columns.email')}</Text>
                    </th>
                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>
                      <Text variant="headingSm">{i18n.translate('admin.mail_service.customers.columns.displayName')}</Text>
                    </th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>
                      <Text variant="headingSm">{i18n.translate('admin.mail_service.customers.columns.bids')}</Text>
                    </th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>
                      <Text variant="headingSm">{i18n.translate('admin.mail_service.customers.columns.wins')}</Text>
                    </th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>
                      <Text variant="headingSm">{i18n.translate('admin.mail_service.customers.columns.status')}</Text>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => (
                    <tr
                      key={customer._id}
                      style={{
                        borderBottom: '1px solid var(--p-color-border-subdued, #dfe3e8)',
                        background: selectedIds.has(customer._id) ? 'var(--p-color-bg-surface-selected, #f0f5ff)' : 'transparent'
                      }}
                    >
                      <td style={{ padding: '8px 12px' }}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(customer._id)}
                          onChange={() => handleToggleSelect(customer._id)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <Text>{customer.email}</Text>
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <Text>{customer.displayName || '\u2014'}</Text>
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                        <Text>{customer.totalBids || 0}</Text>
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                        <Text>{customer.auctionsWon || 0}</Text>
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        {customer.unsubscribed ? (
                          <Badge tone="warning">{i18n.translate('admin.mail_service.customers.status.unsubscribed')}</Badge>
                        ) : (
                          <Badge tone="success">{i18n.translate('admin.mail_service.customers.status.subscribed')}</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, paddingTop: 8 }}>
                  <Button
                    size="slim"
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    {i18n.translate('admin.mail_service.customers.pagination.previous')}
                  </Button>
                  <Text>{i18n.translate('admin.mail_service.customers.pagination.page', { current: page, total: totalPages })}</Text>
                  <Button
                    size="slim"
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                  >
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

export default CustomerListTab;
