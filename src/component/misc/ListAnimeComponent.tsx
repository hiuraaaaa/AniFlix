import Icon from '@react-native-vector-icons/fontawesome';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { StackActions } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import moment from 'moment';
import { useMemo } from 'react';
import { StyleSheet, Text, useColorScheme, useWindowDimensions, View } from 'react-native';
import { useTheme } from 'react-native-paper';

import { NewAnimeList } from '@/types/anime';
import { HomeNavigator, RootStackNavigator } from '@/types/navigation';
import useGlobalStyles from '@assets/style';
import { Movies } from '@utils/scrapers/animeMovie';

import { LatestComicsRelease } from '@utils/scrapers/comicsv2';
import { FilmHomePage } from '@utils/scrapers/film';
import { MIN_IMAGE_HEIGHT, MIN_IMAGE_WIDTH } from '@component/Home/AnimeList';
import ImageLoading from './ImageLoading';
import { TouchableOpacity } from './TouchableOpacityRNGH';

export function ListAnimeComponent(
  props: (
    | {
        newAnimeData: NewAnimeList;
        type?: 'anime';
      }
    | { newAnimeData: Movies; type: 'movie' }
    | { newAnimeData: LatestComicsRelease; type: 'comics' }
    | { newAnimeData: FilmHomePage[number]; type: 'film' }
  ) & {
    navigationProp:
      | NativeStackNavigationProp<HomeNavigator, 'AnimeList', undefined>
      | NativeStackNavigationProp<RootStackNavigator, 'SeeMore', undefined>
      | BottomTabNavigationProp<HomeNavigator, 'AnimeList', undefined>
      | BottomTabNavigationProp<RootStackNavigator, 'SeeMore', undefined>;
  } & { gap?: boolean; fromSeeMore?: boolean },
) {
  const styles = useStyles();
  const z = props.newAnimeData;
  const navigation = props.navigationProp;

  const episodeOrChapter = useMemo(() => {
    if (props.type === 'movie') {
      return 'Movie';
    } else if (props.type === 'comics') {
      return 'Chapter ' + props.newAnimeData.latestChapter;
    } else if (props.type === 'film') {
      return props.newAnimeData.contentType === 'movie' ? 'Movie' : 'Series';
    } else {
      return props.newAnimeData.episode;
    }
  }, [props.newAnimeData, props.type]);
  const releaseDay = useMemo(() => {
    if (props.type === 'movie') {
      return 'Sub Indo';
    } else if (props.type === 'comics') {
      return props.newAnimeData.type + ' | ' + moment(props.newAnimeData.updatedAt).fromNow();
    } else {
      return props.type === 'film' ? props.newAnimeData.year : props.newAnimeData.releaseDay;
    }
  }, [props.newAnimeData, props.type]);

  return (
    <TouchableOpacity
      style={[
        {
          margin: props.gap ? 3 : 0,
          gap: 4,
        },
        styles.listContainer,
      ]}
      onPress={() => {
        navigation.dispatch(
          StackActions.push('FromUrl', {
            title: props.newAnimeData.title,
            link:
              props.type === 'movie'
                ? props.newAnimeData.url
                : props.type === 'comics'
                  ? props.newAnimeData.detailUrl
                  : props.type === 'film'
                    ? props.newAnimeData.url
                    : props.newAnimeData.streamingLink,
            type: props.type,
          }),
        );
      }}>
      <ImageLoading
        resizeMode="stretch"
        key={z.thumbnailUrl}
        source={{ uri: z.thumbnailUrl }}
        style={styles.listBackground}>
        <View style={{ flex: 1, justifyContent: 'space-between', flexDirection: 'row' }}>
          <View style={styles.animeEpisodeContainer}>
            <Text style={styles.animeEpisode}>{episodeOrChapter}</Text>
          </View>
          {'rating' in z && (
            <View style={[styles.animeEpisodeContainer]}>
              <Text style={styles.animeEpisode}>
                <Icon name="star" size={10} color="#FFD700" /> {z.rating}
              </Text>
            </View>
          )}
        </View>
      </ImageLoading>
      <View
        style={[
          styles.animeTitleContainer,
          {
            maxWidth: styles.listBackground.width,
          },
        ]}>
        <Text numberOfLines={1} style={styles.animeTitle}>
          {z.title}
        </Text>
      </View>
      <View
        style={[
          styles.infoContainer,
          {
            maxWidth: styles.listBackground.width,
          },
        ]}>
        <View style={styles.animeReleaseDayContainer}>
          <Text style={styles.animeReleaseDay}>
            <Icon
              color={styles.animeReleaseDay.color}
              name={
                props.type === 'movie' ? 'check' : props.type === 'comics' ? 'book' : 'calendar'
              }
            />{' '}
            {releaseDay}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function useStyles() {
  const dimensions = useWindowDimensions();
  const theme = useTheme();
  const globalStyles = useGlobalStyles();
  const colorScheme = useColorScheme();
  let LIST_BACKGROUND_HEIGHT = (dimensions.height * 120) / 200 / 3.5;
  let LIST_BACKGROUND_WIDTH = (dimensions.width * 120) / 200 / 2.8;
  LIST_BACKGROUND_HEIGHT = Math.max(LIST_BACKGROUND_HEIGHT, MIN_IMAGE_HEIGHT);
  LIST_BACKGROUND_WIDTH = Math.max(LIST_BACKGROUND_WIDTH, MIN_IMAGE_WIDTH);
  return useMemo(
    () =>
      StyleSheet.create({
        listContainer: {
          overflow: 'hidden',
          elevation: 2,
          padding: 5,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colorScheme === 'dark' ? '#333' : '#e0e0e0',
          backgroundColor: colorScheme === 'dark' ? '#1f1f1f' : '#ffffff',
          borderRadius: 8,
        },
        listBackground: {
          overflow: 'hidden',
          width: LIST_BACKGROUND_WIDTH,
          height: LIST_BACKGROUND_HEIGHT,
          borderRadius: 5,
          alignSelf: 'center',
        },
        infoContainer: {
          flex: 1,
          flexDirection: 'row',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
        },
        animeTitleContainer: {
          justifyContent: 'flex-start',
          alignItems: 'center',
        },
        animeTitle: {
          fontSize: 11,
          textAlign: 'center',
          color: globalStyles.text.color,
          fontWeight: 'bold',
        },
        animeEpisodeContainer: {
          backgroundColor: '#000000b0',
          alignSelf: 'flex-start',
          padding: 3,
          borderRadius: 4,
        },
        animeEpisode: {
          fontSize: 9,
          color: 'white',
          fontWeight: 'bold',
        },
        animeReleaseDayContainer: {},
        animeReleaseDay: {
          fontSize: 10,
          color: theme.colors.tertiary,
          opacity: 0.8,
          fontWeight: 'bold',
        },
      }),
    [
      theme.colors.onBackground,
      theme.colors.tertiary,
      colorScheme,
      LIST_BACKGROUND_WIDTH,
      LIST_BACKGROUND_HEIGHT,
      globalStyles.text.color,
    ],
  );
}
