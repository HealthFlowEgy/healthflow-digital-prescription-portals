import React, { useState, useEffect } from 'react';
import { FlatList } from 'react-native';
import { Card, Text, Badge } from 'react-native-paper';
import { useWebSocket } from '../hooks/useWebSocket';

export const NotificationsScreen: React.FC = () => {
  const [notifications, setNotifications] = useState([]);
  const { subscribe } = useWebSocket();

  useEffect(() => {
    const unsubscribe = subscribe('notification', (data) => {
      setNotifications(prev => [data, ...prev]);
    });
    return unsubscribe;
  }, []);

  return (
    <FlatList
      data={notifications}
      renderItem={({ item }) => (
        <Card style={{ margin: 8 }}>
          <Card.Content>
            <Text style={{ fontWeight: 'bold' }}>{item.title}</Text>
            <Text>{item.message}</Text>
            <Text style={{ fontSize: 12, color: '#666', marginTop: 8 }}>
              {new Date(item.timestamp).toLocaleString()}
            </Text>
          </Card.Content>
        </Card>
      )}
      keyExtractor={(item, index) => index.toString()}
    />
  );
};
