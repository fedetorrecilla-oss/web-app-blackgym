import { Stack } from 'expo-router';
import Colors from '@/constants/colors';

export default function ConfigLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.surface },
        headerTintColor: Colors.text,
        headerTitleStyle: { color: Colors.text },
      }}
    />
  );
}
