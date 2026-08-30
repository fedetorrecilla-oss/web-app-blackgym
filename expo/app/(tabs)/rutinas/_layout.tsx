import { Stack } from 'expo-router';
import Colors from '@/constants/colors';

export default function RutinasLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.surface },
        headerTintColor: Colors.text,
        headerTitleStyle: { fontWeight: '700' as const, color: Colors.text },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Rutinas' }} />
      <Stack.Screen name="template" options={{ title: 'Template' }} />
      <Stack.Screen name="day" options={{ title: 'Día' }} />
      <Stack.Screen name="catalog" options={{ title: 'Biblioteca de Ejercicios' }} />
      <Stack.Screen name="assign" options={{ title: 'Asignar Rutina' }} />
    </Stack>
  );
}
