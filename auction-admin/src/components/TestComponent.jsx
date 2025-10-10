import React from 'react';
import { Card, Text } from '@shopify/polaris';

const TestComponent = () => {
  return (
    <Card sectioned>
      <Text variant="headingLg">🚨 THIS IS A TEST COMPONENT - IF YOU SEE THIS, CHANGES ARE WORKING! 🚨</Text>
      <Text variant="bodyMd">This component was created to test if hot reload is working.</Text>
    </Card>
  );
};

export default TestComponent;
