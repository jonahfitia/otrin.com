import React from 'react';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { StatusBar } from 'expo-status-bar';

import LoginScreen from '@/screens/LoginScreen';
import DashboardScreen from '@/screens/DashboardScreen';
import TransactionsScreen from '@/screens/TransactionsScreen';
import AccountsScreen from '@/screens/AccountsScreen';
import BudgetScreen from '@/screens/BudgetScreen';
import GoalsScreen from '@/screens/GoalsScreen';
import CategoriesScreen from '@/screens/CategoriesScreen';
import ReportsScreen from '@/screens/ReportsScreen';
import RecurringScreen from '@/screens/RecurringScreen';
import SettingsScreen from '@/screens/SettingsScreen';
import SimulationScreen from '@/screens/SimulationScreen';

import { colors } from '@/components/theme';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { paddingBottom: 4, height: 56 },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Accueil',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Transactions"
        component={TransactionsScreen}
        options={{
          tabBarLabel: 'Transactions',
          tabBarIcon: ({ color, size }) => <Ionicons name="swap-horizontal" color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Accounts"
        component={AccountsScreen}
        options={{
          tabBarLabel: 'Comptes',
          tabBarIcon: ({ color, size }) => <Ionicons name="wallet" color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Reports"
        component={ReportsScreen}
        options={{
          tabBarLabel: 'Rapports',
          tabBarIcon: ({ color, size }) => <Ionicons name="bar-chart" color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="More"
        component={MoreStack}
        options={{
          tabBarLabel: 'Plus',
          tabBarIcon: ({ color, size }) => <Ionicons name="menu" color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
  );
}

function MoreStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MoreMenu" component={MoreMenuScreen} />
      <Stack.Screen name="Budget" component={BudgetScreen} />
      <Stack.Screen name="Goals" component={GoalsScreen} />
      <Stack.Screen name="Categories" component={CategoriesScreen} />
      <Stack.Screen name="Recurring" component={RecurringScreen} />
      <Stack.Screen name="Simulation" component={SimulationScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
    </Stack.Navigator>
  );
}

function MoreMenuScreen({ navigation }: any) {
  return <MoreMenu navigation={navigation} />;
}

import MoreMenu from '@/screens/MoreMenu';

export default function AppNavigator() {
  const { user, loading } = useAuth();
  const { theme } = useSettings();

  const isDark = theme === 'dark';
  const navTheme = isDark ? DarkTheme : DefaultTheme;

  if (loading) {
    return null;
  }

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <Stack.Screen name="Main" component={MainTabs} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
