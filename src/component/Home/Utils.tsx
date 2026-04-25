import { createNativeStackNavigator, NativeStackScreenProps } from '@react-navigation/native-stack';
import { memo, useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Appbar, Text, TouchableRipple, useTheme } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { UtilsStackNavigator } from '@/types/navigation';
import About from './Utilitas/About';
import Changelog from './Utilitas/Changelog';
import SearchAnimeByImage from './Utilitas/SearchAnimeByImage';
import Setting from './Utilitas/Setting';

const Stack = createNativeStackNavigator<UtilsStackNavigator>();

function Utils() {
  return (
    <Stack.Navigator
      screenOptions={{
        header: props => (
          <Appbar.Header>
            {props.back && (
              <Appbar.BackAction onPress={() => props.navigation.goBack()} />
            )}
            <Appbar.Content
              titleStyle={{ fontWeight: 'bold' }}
              title={
                typeof props.options.headerTitle === 'string'
                  ? props.options.headerTitle
                  : (props.options.title ?? '')
              }
            />
          </Appbar.Header>
        ),
      }}
      initialRouteName="ChooseScreen">
      <Stack.Screen name="ChooseScreen" component={ChooseScreen} options={{ title: 'Utilitas' }} />
      <Stack.Screen name="SearchAnimeByImage" component={SearchAnimeByImage} options={{ title: 'Cari Anime dari Gambar' }} />
      <Stack.Screen name="Changelog" component={Changelog} options={{ title: 'Changelog' }} />
      <Stack.Screen name="Setting" component={Setting} options={{ title: 'Pengaturan' }} />
      <Stack.Screen name="About" component={About} options={{ title: 'Tentang' }} />
    </Stack.Navigator>
  );
}

export default memo(Utils);

const Screens = [
  {
    title: 'Cari Anime dari Gambar',
    desc: 'Cari judul anime dari gambar screenshot.',
    icon: 'image-search',
    color: '#3a8fac',
    screen: 'SearchAnimeByImage',
  },
  {
    title: 'Catatan Update',
    desc: 'Perubahan setiap update mulai dari versi 0.6.0',
    icon: 'history',
    color: '#417e3b',
    screen: 'Changelog',
  },
  {
    title: 'Pengaturan',
    desc: 'Atur aplikasi Lunar kamu',
    icon: 'cog',
    color: '#615e58',
    screen: 'Setting',
  },
  {
    title: 'Tentang Aplikasi',
    desc: 'Tentang Lunar dan pengembangnya, Robin',
    icon: 'information',
    color: '#166db4',
    screen: 'About',
  },
] as const;

function ChooseScreen(props: NativeStackScreenProps<UtilsStackNavigator, 'ChooseScreen'>) {
  const styles = useStyles();
  const theme = useTheme();

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { backgroundColor: theme.colors.background }]}>
      {Screens.map((screen, index) => (
        <TouchableRipple
          key={index}
          onPress={() => props.navigation.navigate(screen.screen as any)}
          rippleColor={theme.colors.primaryContainer}
          style={[styles.row, { borderBottomColor: theme.colors.outlineVariant }]}>
          <View style={styles.rowInner}>
            <View style={[styles.iconContainer, { backgroundColor: theme.colors.secondaryContainer }]}>
              <MaterialCommunityIcons name={screen.icon} size={24} color={screen.color} />
            </View>
            <View style={styles.textContainer}>
              <Text variant="titleSmall" style={{ color: theme.colors.onSurface, fontWeight: 'bold' }}>
                {screen.title}
              </Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>
                {screen.desc}
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={22} color={theme.colors.onSurfaceVariant} />
          </View>
        </TouchableRipple>
      ))}
    </ScrollView>
  );
}

function useStyles() {
  const theme = useTheme();

  return useMemo(
    () =>
      StyleSheet.create({
        container: {
          paddingTop: 8,
          paddingBottom: 24,
        },
        row: {
          borderBottomWidth: StyleSheet.hairlineWidth,
          paddingHorizontal: 16,
          paddingVertical: 14,
        },
        rowInner: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
        },
        iconContainer: {
          width: 44,
          height: 44,
          borderRadius: 22,
          justifyContent: 'center',
          alignItems: 'center',
        },
        textContainer: {
          flex: 1,
        },
      }),
    [theme.colors.secondaryContainer],
  );
}
