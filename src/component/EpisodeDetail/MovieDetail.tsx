import Icon from '@react-native-vector-icons/fontawesome';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FlashList, FlashListRef } from '@shopify/flash-list';
import { RecyclerViewProps } from '@shopify/flash-list/dist/recyclerview/RecyclerViewProps';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  ToastAndroid,
  TouchableOpacity,
  View,
  useColorScheme,
  useWindowDimensions,
} from 'react-native';
import { Button, Chip, useTheme } from 'react-native-paper';
import Reanimated, {
  interpolate,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollOffset,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HistoryItemKey } from '@/types/databaseTarget';
import { HistoryJSON } from '@/types/historyJSON';
import { RootStackNavigator } from '@/types/navigation';
import watchLaterJSON from '@/types/watchLaterJSON';
import useGlobalStyles from '@assets/style';
import ImageLoading from '@component/misc/ImageLoading';
import { DatabaseManager, useModifiedKeyValueIfFocused } from '@utils/DatabaseManager';
import controlWatchLater from '@utils/watchLaterControl';

interface MovieEpisode {
  title: string;
  url: string;
}

type RecyclerViewType = (
  props: RecyclerViewProps<MovieEpisode> & {
    ref?: React.Ref<FlashListRef<MovieEpisode>>;
  },
) => React.JSX.Element;
const ReanimatedFlashList = Reanimated.createAnimatedComponent<RecyclerViewType>(FlashList);

type Props = NativeStackScreenProps<RootStackNavigator, 'MovieDetail'>;

const IMG_HEADER_HEIGHT = 280;

function MovieDetail(props: Props) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();

  const data = props.route.params.data;

  const watchLaterListsJson = useModifiedKeyValueIfFocused(
    'watchLater',
    state => JSON.parse(state) as watchLaterJSON[],
  );
  const isInList = watchLaterListsJson.some(
    item => item.title === data.title.replace('Subtitle Indonesia', '') && item.isMovie,
  );

  const historyListsJson = useModifiedKeyValueIfFocused(
    'historyKeyCollectionsOrder',
    state => JSON.parse(state) as HistoryItemKey[],
  );
  const historyTitle = data.title.replace('Subtitle Indonesia', '').trim();
  const lastWatched = useMemo(() => {
    const isLastWatched = historyListsJson.find(
      z => z === `historyItem:${historyTitle}:false:true`,
    );
    if (isLastWatched) {
      return JSON.parse(DatabaseManager.getSync(isLastWatched)!) as HistoryJSON;
    } else return undefined;
  }, [historyListsJson, historyTitle]);

  const scrollRef = useAnimatedRef<FlashListRef<MovieEpisode>>();
  const scrollOffset = useScrollOffset(scrollRef as any);

  const headerImageStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: interpolate(
            scrollOffset.value,
            [0, IMG_HEADER_HEIGHT * 2],
            [0, IMG_HEADER_HEIGHT],
            'clamp',
          ),
        },
      ],
      opacity: interpolate(scrollOffset.value, [0, IMG_HEADER_HEIGHT], [1, 0], 'clamp'),
    };
  });

  const listHeaderComponent = (
    <MovieDetailHeader
      data={data}
      headerImageStyle={headerImageStyle}
      isInList={isInList}
      lastWatched={lastWatched}
      link={props.route.params.link}
      navigation={props.navigation}
    />
  );

  return (
    <ReanimatedFlashList
      ref={scrollRef}
      data={data.episodeList.length > 1 ? data.episodeList.toReversed() : []}
      renderItem={({ item, index }) => (
        <RenderMovieEpisodeItem
          item={item}
          index={index}
          lastWatched={lastWatched}
          navigation={props.navigation}
          routeTitle={data.title}
        />
      )}
      keyExtractor={item => item.title}
      contentContainerStyle={{
        backgroundColor: styles.mainContainer.backgroundColor,
        paddingLeft: insets.left,
        paddingRight: insets.right,
        paddingBottom: insets.bottom + 20,
      }}
      ListHeaderComponentStyle={[styles.mainContainer, { marginBottom: 8 }]}
      ListHeaderComponent={listHeaderComponent}
      extraData={colorScheme}
      showsVerticalScrollIndicator={false}
    />
  );
}

interface MovieDetailHeaderProps {
  data: Props['route']['params']['data'];
  headerImageStyle: any;
  isInList: boolean;
  lastWatched: HistoryJSON | undefined;
  link: string;
  navigation: Props['navigation'];
}

const MovieDetailHeader = memo(
  ({ data, headerImageStyle, isInList, lastWatched, link, navigation }: MovieDetailHeaderProps) => {
    const styles = useStyles();
    const globalStyles = useGlobalStyles();
    const theme = useTheme();
    const colorScheme = useColorScheme();
    const hasMultipleEpisodes = data.episodeList.length > 1;
    const isDark = colorScheme === 'dark';

    return (
      <View style={styles.mainContainer}>
        {/* Hero Image */}
        <Reanimated.View style={[{ width: '100%', height: IMG_HEADER_HEIGHT }, headerImageStyle]}>
          <ImageLoading
            source={{ uri: data.thumbnailUrl }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['transparent', isDark ? '#0c0c0c' : '#f5f5f5']}
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 120,
            }}
          />
        </Reanimated.View>

        {/* Main Content */}
        <View style={styles.mainContent}>
          {/* Poster + Info Row */}
          <View style={styles.posterRow}>
            <ImageLoading
              source={{ uri: data.thumbnailUrl }}
              style={styles.thumbnail}
              resizeMode="stretch"
            />
            <View style={styles.infoContainer}>
              <Text style={styles.title} numberOfLines={3}>
                {data.title.replace('Subtitle Indonesia', '').trim()}
              </Text>
              <View style={styles.badgeRow}>
                <View style={[styles.badge, { backgroundColor: isDark ? '#00608d' : '#5ddfff' }]}>
                  <Text style={styles.badgeText}>Movie</Text>
                </View>
                {data.rating !== '' && (
                  <View style={[styles.badge, { backgroundColor: theme.colors.secondaryContainer }]}>
                    <Icon name="star" size={11} color="#FFD700" />
                    <Text style={[styles.badgeText, { color: theme.colors.onSecondaryContainer }]}>
                      {' '}{data.rating}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.studio}>
                <Icon name="building" size={12} color={styles.studio.color} /> {data.studio}
              </Text>
              <Text style={styles.date}>
                <Icon name="calendar" size={12} color={styles.date.color} /> {data.releaseDate}
              </Text>
            </View>
          </View>

          {/* Genres */}
          {data.genres.length > 0 && (
            <View style={styles.genreContainer}>
              {data.genres.map(genre => (
                <Chip
                  key={genre}
                  compact
                  style={styles.genreChip}
                  textStyle={styles.genreText}>
                  {genre}
                </Chip>
              ))}
            </View>
          )}

          {/* Synopsis */}
          <View style={styles.synopsisContainer}>
            <Text style={styles.sectionTitle}>Sinopsis</Text>
            <Text style={styles.synopsisText}>
              {data.synopsis === '' ? 'Tidak ada sinopsis yang tersedia.' : data.synopsis}
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            {hasMultipleEpisodes ? (
              <>
                {lastWatched && lastWatched.episode && (
                  <Button
                    mode="contained"
                    icon="play"
                    style={styles.primaryButton}
                    onPress={() => {
                      navigation.navigate('FromUrl', {
                        title: data.title,
                        link: lastWatched.link,
                        historyData: lastWatched
                          ? {
                              lastDuration: lastWatched.lastDuration ?? 0,
                              resolution: lastWatched.resolution ?? '',
                            }
                          : undefined,
                      });
                    }}>
                    Lanjut ({lastWatched.episode.replace('Subtitle Indonesia', '').trim()})
                  </Button>
                )}
                <View style={styles.secondaryButtons}>
                  <Button
                    mode="outlined"
                    style={[styles.halfButton]}
                    onPress={() => {
                      navigation.navigate('FromUrl', {
                        title: data.title,
                        link: data.episodeList[data.episodeList.length - 1].url,
                        type: 'movie',
                      });
                    }}>
                    Episode Pertama
                  </Button>
                  <Button
                    mode="outlined"
                    style={[styles.halfButton]}
                    onPress={() => {
                      navigation.navigate('FromUrl', {
                        title: data.title,
                        link: data.episodeList[0].url,
                        type: 'movie',
                      });
                    }}>
                    Episode Terakhir
                  </Button>
                </View>
              </>
            ) : (
              <Button
                mode="contained"
                icon="movie-open-play"
                style={styles.primaryButton}
                onPress={() => {
                  navigation.navigate('FromUrl', {
                    title: data.title,
                    link: data.streamingUrl,
                    type: 'movie',
                    historyData: lastWatched
                      ? {
                          lastDuration: lastWatched.lastDuration ?? 0,
                          resolution: lastWatched.resolution ?? '',
                        }
                      : undefined,
                  });
                }}>
                Tonton Sekarang
              </Button>
            )}

            <Button
              mode="outlined"
              icon="playlist-plus"
              style={styles.watchLaterButton}
              onPress={() => {
                const watchLaterJson: watchLaterJSON = {
                  title: data.title.replace('Subtitle Indonesia', ''),
                  link: link,
                  rating: data.rating,
                  releaseYear: data.releaseDate,
                  thumbnailUrl: data.thumbnailUrl,
                  genre: data.genres,
                  date: Date.now(),
                  isMovie: true,
                };
                controlWatchLater('add', watchLaterJson);
                ToastAndroid.show('Ditambahkan ke tonton nanti', ToastAndroid.SHORT);
              }}
              disabled={isInList}>
              {isInList ? 'Sudah di Tonton Nanti' : 'Tonton Nanti'}
            </Button>
          </View>

          {/* Episode List Header */}
          {hasMultipleEpisodes && (
            <View style={styles.episodeListHeader}>
              <Text style={styles.sectionTitle}>Daftar Episode</Text>
              <Text style={styles.episodeCount}>{data.episodeList.length} Episode</Text>
            </View>
          )}
        </View>
      </View>
    );
  },
);

interface RenderMovieEpisodeItemProps {
  item: MovieEpisode;
  index: number;
  lastWatched: HistoryJSON | undefined;
  navigation: Props['navigation'];
  routeTitle: string;
}

const RenderMovieEpisodeItem = memo(
  ({ item, index, lastWatched, navigation, routeTitle }: RenderMovieEpisodeItemProps) => {
    const styles = useStyles();
    const globalStyles = useGlobalStyles();
    const colorScheme = useColorScheme();
    const theme = useTheme();

    const isLastWatched =
      lastWatched && lastWatched.episode && item.title.includes(lastWatched?.episode);

    return (
      <View style={styles.episodeListContainer}>
        <TouchableOpacity
          style={[styles.episodeButton, isLastWatched && styles.lastWatchedButton]}
          onPress={() => {
            navigation.navigate('FromUrl', {
              title: routeTitle,
              link: item.url,
              historyData: isLastWatched
                ? {
                    lastDuration: lastWatched.lastDuration ?? 0,
                    resolution: lastWatched.resolution ?? '',
                  }
                : undefined,
              type: 'movie',
            });
          }}>
          <View style={styles.episodeMainContent}>
            <View style={[styles.episodeNumberBox, isLastWatched && { backgroundColor: theme.colors.primary }]}>
              <Text style={[styles.episodeNumberText, isLastWatched && { color: '#fff' }]}>{index + 1}</Text>
            </View>
            <View style={styles.episodeTitleWrapper}>
              <Text
                numberOfLines={1}
                style={[
                  styles.episodeText,
                  isLastWatched && { color: theme.colors.primary },
                ]}>
                {item.title}
              </Text>
              {isLastWatched && (
                <Text style={styles.watchingNowTag}>● Terakhir Ditonton</Text>
              )}
            </View>
            <Icon
              name={isLastWatched ? 'history' : 'play-circle'}
              size={22}
              color={isLastWatched ? theme.colors.primary : colorScheme === 'dark' ? '#5ddfff' : '#00608d'}
            />
          </View>
        </TouchableOpacity>
      </View>
    );
  },
);

function useStyles() {
  const theme = useTheme();
  const globalStyles = useGlobalStyles();
  const colorScheme = useColorScheme();
  const dimensions = useWindowDimensions();
  const isDark = colorScheme === 'dark';

  return useMemo(
    () =>
      StyleSheet.create({
        mainContainer: {
          flex: 1,
          backgroundColor: isDark ? '#0c0c0c' : '#f5f5f5',
        },
        mainContent: {
          paddingHorizontal: 16,
          paddingTop: 12,
          gap: 16,
        },
        posterRow: {
          flexDirection: 'row',
          gap: 14,
          marginTop: -60,
        },
        thumbnail: {
          width: dimensions.width * 0.28,
          height: 150,
          borderRadius: 12,
          elevation: 6,
        },
        infoContainer: {
          flex: 1,
          gap: 6,
          paddingTop: 8,
        },
        title: {
          fontSize: 18,
          fontWeight: 'bold',
          color: globalStyles.text.color,
          lineHeight: 24,
        },
        badgeRow: {
          flexDirection: 'row',
          gap: 6,
          flexWrap: 'wrap',
        },
        badge: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 6,
        },
        badgeText: {
          fontSize: 11,
          fontWeight: 'bold',
          color: isDark ? 'white' : 'black',
        },
        studio: {
          fontSize: 12,
          color: isDark ? '#5ddfff' : '#00608d',
        },
        date: {
          fontSize: 12,
          color: isDark ? '#aaa' : '#777',
        },
        genreContainer: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 6,
        },
        genreChip: {
          backgroundColor: theme.colors.secondaryContainer,
          height: 28,
        },
        genreText: {
          fontSize: 11,
          color: theme.colors.onSecondaryContainer,
        },
        synopsisContainer: {
          gap: 6,
        },
        sectionTitle: {
          fontSize: 16,
          fontWeight: 'bold',
          color: globalStyles.text.color,
        },
        synopsisText: {
          fontSize: 14,
          lineHeight: 22,
          color: isDark ? '#ccc' : '#555',
          textAlign: 'justify',
        },
        actionButtons: {
          gap: 10,
        },
        primaryButton: {
          borderRadius: 10,
        },
        secondaryButtons: {
          flexDirection: 'row',
          gap: 10,
        },
        halfButton: {
          flex: 1,
          borderRadius: 10,
        },
        watchLaterButton: {
          borderRadius: 10,
        },
        episodeListHeader: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: 8,
          borderBottomWidth: 1,
          borderBottomColor: isDark ? '#222' : '#e0e0e0',
        },
        episodeCount: {
          fontSize: 13,
          color: isDark ? '#888' : '#999',
        },
        episodeListContainer: {
          paddingHorizontal: 16,
          marginBottom: 8,
        },
        episodeButton: {
          backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
          borderRadius: 12,
          padding: 14,
          elevation: 1,
        },
        lastWatchedButton: {
          backgroundColor: theme.colors.primaryContainer,
          borderWidth: 1,
          borderColor: theme.colors.primary,
        },
        episodeMainContent: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        },
        episodeNumberBox: {
          width: 36,
          height: 36,
          backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0',
          borderRadius: 8,
          justifyContent: 'center',
          alignItems: 'center',
        },
        episodeNumberText: {
          fontSize: 14,
          fontWeight: 'bold',
          color: isDark ? '#fff' : '#333',
        },
        episodeTitleWrapper: {
          flex: 1,
        },
        episodeText: {
          fontSize: 14,
          fontWeight: '600',
          color: isDark ? '#e0e0e0' : '#333',
        },
        watchingNowTag: {
          fontSize: 10,
          fontWeight: 'bold',
          color: theme.colors.primary,
          marginTop: 2,
        },
        lastWatchedTextColor: {
          color: theme.colors.onPrimaryContainer,
        },
      }),
    [
      isDark,
      colorScheme,
      dimensions.width,
      globalStyles.text.color,
      theme.colors.secondaryContainer,
      theme.colors.onSecondaryContainer,
      theme.colors.primaryContainer,
      theme.colors.primary,
      theme.colors.onPrimaryContainer,
    ],
  );
}

export default memo(MovieDetail);
