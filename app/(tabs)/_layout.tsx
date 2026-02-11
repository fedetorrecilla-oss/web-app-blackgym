import { Tabs } from 'expo-router';
import { CalendarDays, ClipboardList, Users, Wallet, Settings, Dumbbell, TrendingUp } from 'lucide-react-native';
import React from 'react';
import Colors from '@/constants/colors';
import { useGym } from '@/context/GymContext';

export default function TabLayout() {
  const { currentUser } = useGym();
  const isAdmin = currentUser?.role === 'admin';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600' as const,
        },
      }}
    >
      <Tabs.Screen
        name="schedule"
        options={{
          title: 'Horarios',
          tabBarIcon: ({ color, size }) => (
            <CalendarDays size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: 'Mis Turnos',
          tabBarIcon: ({ color, size }) => (
            <ClipboardList size={size} color={color} />
          ),
          href: isAdmin ? null : undefined,
        }}
      />
      <Tabs.Screen
        name="students"
        options={{
          title: 'Alumnos',
          tabBarIcon: ({ color, size }) => (
            <Users size={size} color={color} />
          ),
          href: isAdmin ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="payments"
        options={{
          title: 'Pagos',
          tabBarIcon: ({ color, size }) => (
            <Wallet size={size} color={color} />
          ),
          href: isAdmin ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="rutinas"
        options={{
          title: 'Rutinas',
          tabBarIcon: ({ color, size }) => (
            <Dumbbell size={size} color={color} />
          ),
          href: isAdmin ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="mi-rutina"
        options={{
          title: 'Mi Rutina',
          tabBarIcon: ({ color, size }) => (
            <Dumbbell size={size} color={color} />
          ),
          href: isAdmin ? null : undefined,
        }}
      />
      <Tabs.Screen
        name="progreso"
        options={{
          title: 'Progreso',
          tabBarIcon: ({ color, size }) => (
            <TrendingUp size={size} color={color} />
          ),
          href: isAdmin ? null : undefined,
        }}
      />
      <Tabs.Screen
        name="config"
        options={{
          title: 'Config',
          tabBarIcon: ({ color, size }) => (
            <Settings size={size} color={color} />
          ),
          href: isAdmin ? undefined : null,
        }}
      />
    </Tabs>
  );
}
