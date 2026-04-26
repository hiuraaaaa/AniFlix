import Icon from '@react-native-vector-icons/fontawesome';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { StackActions } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import moment from 'moment';
import { useMemo } from 'react';
import { StyleSheet, Text, useColorScheme, useWindowDimensions, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';

import { NewAnimeList } from '@/types/anime';
import { HomeNavigator, RootStackNavigator } from '@/types/navigation';
import useGlobalStyles from '@assets/style';
import { Movies } from '@utils/scrapers/animeMovie';
import { LatestComicsRelease } from '@utils/scrapers/comicsv2';
import { FilmHomePage } from '@utils/scrapers/film';
import ImageLoading from './ImageLoading';
import { TouchableOpacity } from './TouchableOpacityRNGH';

export function ListAnimeComponent(
  props: (
    | { newAnimeData: NewAnimeList; type?: 'anime' }
    | { newAnimeData: Movies; type: 'movie' }
    | { newAnimeData: LatestComicsRelease; type: 'comics' }
    | { newAnimeData: FilmHomePage[number]; type: 'film' }
  ) & {
    navigationProp:
      | NativeStackNavigationProp<HomeNavigator, 'AnimeList', undefined>
      | NativeStackNavigationProp<RootStackNavigator, 'SeeMore', undefined>
      | BottomTabNavigationProp<HomeNavigator, 'AnimeList', undefined>
      | BottomTabNavigationProp<RootStackNavigator, 'SeeMore', undefined>;
  } & { gap?: boolean; fromSeeMore?: boolean; gridMode?: boolean },
) {
  const styles = useStyles();
  const z = props.newAnimeData;
  const navigation = props.navigationProp;
  const theme = useTheme();

  const episodeOrChapter = useMemo(() => {
    if (props.type === 'movie') return 'Movie';
    else if (props.type === 'comics') return 'Ch. ' + props.newAnimeData.latestChapter;
    else if (props.type === 'film') return props.newAnimeData.contentType === 'movie' ? 'Movie' : 'Series';
    else return props.newAnimeData.episode;
  }, [props.newAnimeData, props.type]);

  const releaseDay = useMemo(() => {
    if (props.type === 'movie') return 'Sub Indo';
    else if (props.type === 'comics') return moment(props.newAnimeData.updatedAt).fromNow();
    else return props.type === 'film' ? props.newAnimeData.year : props.newAnimeData.releaseDay;
  }, [props.newAnimeData, props.type]);

  const navigateToItem = () => {
    navigation.dispatch(
      StackActions.push('FromUrl', {
        title: props.newAnimeData.title,
        link:
          props.type === 'movie' ? props.newAnimeData.url
          : props.type === 'comics' ? props.newAnimeData.detailUrl
          : props.type === 'film' ? props.newAnimeData.url
          : props.newAnimeData.streamingLink,
        type: props.type,
      }),
    );
  };

  const iconName = props.type === 'movie' ? 'check' : props.type === 'comics' ? 'book' : 'calendar';

  // Badge color per type
  const badgeBg = useMemo(() => {
    if (props.type === 'movie') return 'rgba(76,175,80,0.85)';
    if (props.type === 'comics') return 'rgba(255,152,0,0.85)';
    if (props.type === 'film') return 'rgba(33,150,243,0.85)';
    return 'rgba(168,85,247,0.85)'; // anime default — ungu
  }, [props.type]);

  if (props.gridMode) {
    return (
      <TouchableOpacity style={styles.gridCard} onPress={navigateToItem}>
        <ImageLoading resizeMode="cover" source={{ uri: z.thumbnailUrl }} style={styles.gridImage}>
          <View style={styles.topRow}>
            <View style={[styles.episodeBadge, { backgroundColor: badgeBg }]}>
              <Text style={styles.badgeText}>{episodeOrChapter}</Text>
            </View>
            {'rating' in z && z.rating && (
              <View style={styles.ratingBadge}>
                <Icon name="star" size={9} color="#FFD700" />
                <Text style={styles.badgeText}> {z.rating}</Text>
              </View>
            )}
          </View>
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.95)']}
            style={styles.gradient}>
            <Text numberOfLines={2} style={styles.gridTitle}>{z.title}</Text>
            <Text style={styles.subText}>
              <Icon name={iconName} size={9} color={theme.colors.primary} /> {releaseDay}
            </Text>
          </LinearGradient>
        </ImageLoading>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[{ margin: props.gap ? 3 : 0 }, styles.listCard]}
      onPress={navigateToItem}>
      <ImageLoading resizeMode="cover" source={{ uri: z.thumbnailUrl }} style={styles.listImage}>
        <View style={styles.topRow}>
          <View style={[styles.episodeBadge, { backgroundColor: badgeBg }]}>
            <Text style={styles.badgeText}>{episodeOrChapter}</Text>
          </View>
          {'rating' in z && z.rating && (
            <View style={styles.ratingBadge}>
              <Icon name="star" size={9} color="#FFD700" />
              <Text style={styles.badgeText}> {z.rating}</Text>
            </View>
          )}
        </View>
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.95)']}
          style={styles.gradient}>
          <Text numberOfLines={1} style={styles.listTitle}>{z.title}</Text>
          <Text style={styles.subText}>
            <Icon name={iconName} size={9} color={theme.colors.primary} /> {releaseDay}
          </Text>
        </LinearGradient>
      </ImageLoading>
    </TouchableOpacity>
  );
}

function useStyles() {
  const dimensions = useWindowDimensions();
  const theme = useTheme();

  const GRID_W = (dimensions.width - 8) / 3;
  const GRID_H = GRID_W * 1.5;
  const LIST_W = dimensions.width * 0.32;
  const LIST_H = LIST_W * 1.45;

  return useMemo(
    () =>
      StyleSheet.create({
        gridCard: {
          width: GRID_W,
          height: GRID_H,
          borderRadius: 12,
          overflow: 'hidden',
          elevation: 6,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.35,
          shadowRadius: 6,
        },
        gridImage: {
          width: '100%',
          height: '100%',
          justifyContent: 'space-between',
        },
        gridTitle: {
          color: '#fff',
          fontSize: 11,
          fontWeight: 'bold',
          lineHeight: 15,
        },
        listCard: {
          borderRadius: 12,
          overflow: 'hidden',
          elevation: 6,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.35,
          shadowRadius: 6,
          width: LIST_W,
        },
        listImage: {
          width: LIST_W,
          height: LIST_H,
          justifyContent: 'space-between',
        },
        listTitle: {
          color: '#fff',
          fontSize: 11,
          fontWeight: 'bold',
        },
        topRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          padding: 5,
        },
        gradient: {
          paddingHorizontal: 6,
          paddingBottom: 6,
          paddingTop: 20,
        },
        subText: {
          color: '#bbb',
          fontSize: 9,
          marginTop: 2,
        },
        episodeBadge: {
          paddingHorizontal: 6,
          paddingVertical: 2,
          borderRadius: 4,
        },
        ratingBadge: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: 'rgba(0,0,0,0.72)',
          paddingHorizontal: 5,
          paddingVertical: 2,
          borderRadius: 4,
        },
        badgeText: {
          color: '#fff',
          fontSize: 9,
          fontWeight: 'bold',
        },
      }),
    [GRID_W, GRID_H, LIST_W, LIST_H, theme.colors.primary],
  );
}
