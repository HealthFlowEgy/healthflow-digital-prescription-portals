import React, { useState, useEffect } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { Text, Card, Searchbar, ActivityIndicator } from 'react-native-paper';
import { apiClient } from '../services/api';

export const AuditLogViewerScreen: React.FC = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const response = await apiClient.get('/api/v2/eda/audit/logs');
      setLogs(response.data.logs);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;

  return (
    <View style={{ flex: 1 }}>
      <Searchbar
        placeholder="Search logs..."
        value={search}
        onChangeText={setSearch}
        style={{ margin: 16 }}
      />
      <FlatList
        data={logs.filter(l => l.action.includes(search))}
        renderItem={({ item }) => (
          <Card style={{ margin: 8 }}>
            <Card.Content>
              <Text style={{ fontWeight: 'bold' }}>{item.action}</Text>
              <Text>{item.user_email}</Text>
              <Text style={{ fontSize: 12, color: '#666' }}>
                {new Date(item.timestamp).toLocaleString()}
              </Text>
            </Card.Content>
          </Card>
        )}
        keyExtractor={item => item.id}
      />
    </View>
  );
};
