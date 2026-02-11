import { Stack } from 'expo-router';
import Colors from '@/constants/colors';

export default function BookingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.surface },
        headerTintColor: Colors.text,
        headerTitleStyle: { fontWeight: '700' as const, color: Colors.text },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Mis Turnos' }} />
    </Stack>
  );
}
