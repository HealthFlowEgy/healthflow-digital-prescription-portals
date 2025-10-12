import React, { useState, useEffect } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { Text, Card, Chip, ActivityIndicator } from 'react-native-paper';
import { apiClient } from '../services/api';

export const AdverseEventListScreen: React.FC = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const response = await apiClient.get('/api/v2/eda/adverse-events');
      setEvents(response.data.events);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;

  return (
    <FlatList
      data={events}
      renderItem={({ item }) => (
        <Card style={{ margin: 8 }}>
          <Card.Content>
            <Text style={{ fontWeight: 'bold' }}>{item.medicine_name}</Text>
            <Text>{item.event_description}</Text>
            <Chip style={{ marginTop: 8 }}>{item.severity}</Chip>
          </Card.Content>
        </Card>
      )}
      keyExtractor={item => item.id}
    />
  );
};
