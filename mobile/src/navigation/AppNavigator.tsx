// File: mobile/src/navigation/AppNavigator.tsx
// Purpose: Main navigation structure

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

// Auth Screens
import LoginScreen from '../screens/Auth/LoginScreen';
import RegisterScreen from '../screens/Auth/RegisterScreen';
import ForgotPasswordScreen from '../screens/Auth/ForgotPasswordScreen';

// Main Screens
import HomeScreen from '../screens/Home/HomeScreen';
import MedicineSearchScreen from '../screens/Medicine/MedicineSearchScreen';
import MedicineDetailScreen from '../screens/Medicine/MedicineDetailScreen';
import ScannerScreen from '../screens/Scanner/ScannerScreen';
import RecallsScreen from '../screens/Recalls/RecallsScreen';
import RecallDetailScreen from '../screens/Recalls/RecallDetailScreen';
import AdverseEventScreen from '../screens/AdverseEvent/AdverseEventScreen';
import NotificationsScreen from '../screens/Notifications/NotificationsScreen';
import ProfileScreen from '../screens/Profile/ProfileScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string;

          switch (route.name) {
            case 'Home':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'Search':
              iconName = focused ? 'magnify' : 'magnify';
              break;
            case 'Scanner':
              iconName = 'qrcode-scan';
              break;
            case 'Recalls':
              iconName = focused ? 'alert-circle' : 'alert-circle-outline';
              break;
            case 'Profile':
              iconName = focused ? 'account' : 'account-outline';
              break;
            default:
              iconName = 'help';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#1976d2',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Search" component={MedicineSearchScreen} />
      <Tab.Screen name="Scanner" component={ScannerScreen} />
      <Tab.Screen name="Recalls" component={RecallsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        {/* Auth Stack */}
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />

        {/* Main App */}
        <Stack.Screen name="Main" component={MainTabs} />

        {/* Detail Screens */}
        <Stack.Screen
          name="MedicineDetail"
          component={MedicineDetailScreen}
          options={{ headerShown: true, title: 'Medicine Details' }}
        />
        <Stack.Screen
          name="RecallDetail"
          component={RecallDetailScreen}
          options={{ headerShown: true, title: 'Recall Details' }}
        />
        <Stack.Screen
          name="AdverseEvent"
          component={AdverseEventScreen}
          options={{ headerShown: true, title: 'Report Adverse Event' }}
        />
        <Stack.Screen
          name="Notifications"
          component={NotificationsScreen}
          options={{ headerShown: true, title: 'Notifications' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}