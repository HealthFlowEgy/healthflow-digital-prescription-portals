import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, Card, Avatar, List, Divider } from 'react-native-paper';
import { useAuth } from '../hooks/useAuth';

export const ProfileScreen: React.FC = () => {
  const { user } = useAuth();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
      <Card style={{ margin: 16 }}>
        <Card.Content style={{ alignItems: 'center', padding: 24 }}>
          <Avatar.Text size={80} label={user?.name?.[0] || 'U'} />
          <Text style={{ fontSize: 20, fontWeight: 'bold', marginTop: 16 }}>
            {user?.name || 'User'}
          </Text>
          <Text style={{ color: '#666' }}>{user?.email}</Text>
        </Card.Content>
      </Card>

      <Card style={{ margin: 16 }}>
        <List.Item
          title="Role"
          description={user?.role || 'N/A'}
          left={props => <List.Icon {...props} icon="account-badge" />}
        />
        <Divider />
        <List.Item
          title="Tenant"
          description={user?.tenant_name || 'N/A'}
          left={props => <List.Icon {...props} icon="domain" />}
        />
        <Divider />
        <List.Item
          title="Member Since"
          description={user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
          left={props => <List.Icon {...props} icon="calendar" />}
        />
      </Card>
    </ScrollView>
  );
};
