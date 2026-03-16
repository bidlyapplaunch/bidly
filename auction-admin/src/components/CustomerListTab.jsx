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

function CustomerListTab({ onComposeBlast }) {
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
      setError(err.message || 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

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
              <Text variant="headingMd">Customers</Text>
              <Text tone="subdued">{total} customer{total !== 1 ? 's' : ''} linked to this store</Text>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {selectedIds.size > 0 && (
                <Badge tone="info">{selectedIds.size} selected</Badge>
              )}
              <Button primary onClick={handleCompose}>
                Compose Blast Email
              </Button>
            </div>
          </div>

          <TextField
            placeholder="Search by email or name..."
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
              <Text tone="subdued">No customers found</Text>
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
                      <Text variant="headingSm">Email</Text>
                    </th>
                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>
                      <Text variant="headingSm">Display Name</Text>
                    </th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>
                      <Text variant="headingSm">Bids</Text>
                    </th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>
                      <Text variant="headingSm">Wins</Text>
                    </th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>
                      <Text variant="headingSm">Status</Text>
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
                          <Badge tone="warning">Unsubscribed</Badge>
                        ) : (
                          <Badge tone="success">Subscribed</Badge>
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
                    Previous
                  </Button>
                  <Text>Page {page} of {totalPages}</Text>
                  <Button
                    size="slim"
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                  >
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

export default CustomerListTab;
