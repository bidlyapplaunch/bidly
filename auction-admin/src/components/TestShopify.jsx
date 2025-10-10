import React, { useState } from 'react';
import { Card, Text, TextField, Button } from '@shopify/polaris';
import { shopifyAPI } from '../services/api';

const TestShopify = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    try {
      const response = await shopifyAPI.searchProducts(searchQuery, 10);
      setResults(response.data || []);
      console.log('Search results:', response.data);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card sectioned>
      <Text variant="headingLg">🧪 Shopify Search Test</Text>
      <div style={{ marginTop: '16px' }}>
        <TextField
          label="Search Query"
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Enter product name..."
        />
        <div style={{ marginTop: '8px' }}>
          <Button 
            onClick={handleSearch} 
            loading={loading}
            disabled={!searchQuery.trim()}
          >
            Search Products
          </Button>
        </div>
        {results.length > 0 && (
          <div style={{ marginTop: '16px' }}>
            <Text variant="headingMd">Results ({results.length}):</Text>
            {results.map((product) => (
              <div key={product.id} style={{ 
                padding: '8px', 
                border: '1px solid #ccc', 
                margin: '4px 0',
                borderRadius: '4px'
              }}>
                <div><strong>{product.title}</strong></div>
                <div>ID: {product.id} | Price: ${product.price}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
};

export default TestShopify;
