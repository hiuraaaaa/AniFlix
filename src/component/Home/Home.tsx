import MaterialIcons from '@react-native-vector-icons/material-icons';
import {
  BottomTabNavigationOptions,
  createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';
import { CommonActions, useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { lazy, memo, useCallback, useContext, useEffect } from 'react';
import { AndroidSoftInputModes, KeyboardController } from 'react-native-keyboard-controller';
import { BottomNavigation, useTheme } from 'react-native-paper';
import { StyleSheet, useColorScheme, View } from 'react-native';

import { HomeNavigator, RootStackNavigator } from '@/types/navigation';
import { EpisodeBaruHomeContext } from '@misc/context';
import { withSuspenseAndSafeArea } from '@misc/withSuspenseAndSafeArea';

let EpisodeBaruHome: React.ComponentType<any>;
let Search: React.ComponentType<any>;
let Utils: React.ComponentType<any>;
let Saya: React.ComponentType<any>;

if (__DEV__) {
  EpisodeBaruHome = require('./AnimeList').default;
  Search = require('./Search').default;
  Utils = require('./Utils').default;
  Saya = require('./Saya').default;
} else {
  EpisodeBaruHome = lazy(() => import('./AnimeList'));
  Search = lazy(() => import('./Search'));
  Utils = lazy(() => import('./Utils'));
  Saya = lazy(() => import('./Saya'));
}

type Props = NativeStackScreenProps<RootStackNavigator, 'Home'>;
const Tab = createBottomTabNavigator<HomeNavigator>();

const tabScreens: {
  name: keyof HomeNavigator;
  component: (props: any) => React.JSX.Element;
  options: BottomTabNavigationOptions;
}[] = [
  {
    name: 'AnimeList',
    component: withSuspenseAndSafeArea(EpisodeBaruHome, false),
    options: {
      tabBarIcon: ({ color, size }) => <MaterialIcons name="home" size={size} color={color} />,
      tabBarLabel: 'Home',
    },
  },
  {
    name: 'Search',
    component: withSuspenseAndSafeArea(Search, true, false, true),
    options: {
      tabBarIcon: ({ color, size }) => <MaterialIcons name="explore" size={size} color={color} />,
      tabBarLabel: 'Explore',
    },
  },
  {
    name: 'Saya',
    component: withSuspenseAndSafeArea(Saya, false),
    options: {
      tabBarIcon: ({ color, size }) => <MaterialIcons name="video-library" size={size} color={color} />,
      tabBarLabel: 'Library',
    },
  },
  {
    name: 'Utilitas',
    component: withSuspenseAndSafeArea(Utils, false),
    options: {
      tabBarIcon: ({ color, size }) => <MaterialIcons name="menu" size={size} color={color} />,
      tabBarLabel: 'More',
    },
  },
];

function BottomTabs(props: Props) {
  const { setParamsState: setAnimeData } = useContext(EpisodeBaruHomeContext);
  const theme = useTheme();
  const isDark = useColorScheme() === 'dark';

  useEffect(() => {
    setAnimeData?.(props.route.params.data);
  }, [props.route.params.data, setAnimeData]);

  useFocusEffect(
    useCallback(() => {
      KeyboardController.setInputMode(AndroidSoftInputModes.SOFT_INPUT_ADJUST_PAN);
      return () => {
        KeyboardController.setDefaultMode();
      };
    }, []),
  );

  return (
    <Tab.Navigator
      detachInactiveScreens={false}
      screenOptions={{
        animation: 'shift',
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
      }}
      tabBar={({ navigation, state, descriptors, insets }) => (
        <View style={styles.floatingContainer}>
          <View
            style={[
              styles.floatingBar,
              {
                backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
              },
            ]}>
            <BottomNavigation.Bar
              navigationState={state}
              safeAreaInsets={{ ...insets, bottom: 0 }}
              activeColor={theme.colors.primary}
              inactiveColor={isDark ? '#666' : '#999'}
              style={styles.barStyle}
              activeIndicatorStyle={{
                backgroundColor: isDark ? '#2D1F4E' : '#EDE7F6',
                borderRadius: 16,
              }}
              onTabPress={({ route, preventDefault }) => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });

                if (event.defaultPrevented) {
                  preventDefault();
                } else {
                  navigation.dispatch({
                    ...CommonActions.navigate(route.name, route.params),
                    target: state.key,
                  });
                }
              }}
              renderIcon={({ route, focused, color }) =>
                descriptors[route.key].options.tabBarIcon?.({
                  focused,
                  color,
                  size: 24,
                }) || null
              }
              getLabelText={({ route }) => {
                const { options } = descriptors[route.key];
                const label =
                  typeof options.tabBarLabel === 'string'
                    ? options.tabBarLabel
                    : typeof options.title === 'string'
                      ? options.title
                      : route.name;
                return label;
              }}
            />
          </View>
        </View>
      )}>
      {tabScreens.map(({ name, component: Component, options }) => (
        <Tab.Screen key={name} name={name} options={options}>
          {Component}
        </Tab.Screen>
      ))}
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  floatingBar: {
    width: '100%',
    borderRadius: 32,
    overflow: 'hidden',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  barStyle: {
    backgroundColor: 'transparent',
    borderTopWidth: 0,
  },
});

export default memo(BottomTabs);
