import React from 'react';
import { ScrollView } from 'react-native';
import { List, Switch, Divider, Card } from 'react-native-paper';

export const SettingsScreen: React.FC = () => {
  const [notifications, setNotifications] = React.useState(true);
  const [darkMode, setDarkMode] = React.useState(false);
  const [biometric, setBiometric] = React.useState(true);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
      <Card style={{ margin: 16 }}>
        <List.Section>
          <List.Subheader>Notifications</List.Subheader>
          <List.Item
            title="Push Notifications"
            right={() => <Switch value={notifications} onValueChange={setNotifications} />}
          />
          <Divider />
          <List.Subheader>Appearance</List.Subheader>
          <List.Item
            title="Dark Mode"
            right={() => <Switch value={darkMode} onValueChange={setDarkMode} />}
          />
          <Divider />
          <List.Subheader>Security</List.Subheader>
          <List.Item
            title="Biometric Login"
            right={() => <Switch value={biometric} onValueChange={setBiometric} />}
          />
        </List.Section>
      </Card>
    </ScrollView>
  );
};
