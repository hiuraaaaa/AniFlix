import Icon from '@react-native-vector-icons/fontawesome';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FlashList, FlashListRef } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  ToastAndroid,
  TouchableOpacity,
  View,
  useColorScheme,
  useWindowDimensions,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Button, Chip, Divider, Searchbar, useTheme } from 'react-native-paper';
import Reanimated, {
  interpolate,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollOffset,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AniDetailEpsList } from '@/types/anime';
import { HistoryItemKey } from '@/types/databaseTarget';
import { HistoryJSON } from '@/types/historyJSON';
import { RootStackNavigator } from '@/types/navigation';
import watchLaterJSON from '@/types/watchLaterJSON';
import { replaceLast } from '@/utils/replaceLast';
import useGlobalStyles from '@assets/style';
import ImageLoading from '@component/misc/ImageLoading';
import { RecyclerViewProps } from '@shopify/flash-list/dist/recyclerview/RecyclerViewProps';
import { DatabaseManager, useModifiedKeyValueIfFocused } from '@utils/DatabaseManager';
import controlWatchLater from '@utils/watchLaterControl';

type RecyclerViewType = (
  props: RecyclerViewProps<AniDetailEpsList> & { ref?: React.Ref<FlashListRef<AniDetailEpsList>> },
) => React.JSX.Element;
const ReanimatedFlashList = Reanimated.createAnimatedComponent(FlashList as RecyclerViewType);

type Props = NativeStackScreenProps<RootStackNavigator, 'AnimeDetail'>;

const IMG_HEADER_HEIGHT = 280;

function AniDetail(props: Props) {
  const styles = useStyles();
  const globalStyles = useGlobalStyles();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();

  const data = props.route.params.data;

  const watchLaterListsJson = useModifiedKeyValueIfFocused(
    'watchLater',
    state => JSON.parse(state) as watchLaterJSON[],
  );
  const isInList = useMemo(
    () =>
      watchLaterListsJson.some(
        item =>
          item.title === data.title.replace(/Subtitle Indonesia|Sub Indo/, '') &&
          !item.isComics &&
          !item.isMovie,
      ),
    [data.title, watchLaterListsJson],
  );

  const historyListsJson = useModifiedKeyValueIfFocused(
    'historyKeyCollectionsOrder',
    state => JSON.parse(state) as HistoryItemKey[],
  );
  let historyTitle = data.title
    .replace(/Subtitle Indonesia|Sub Indo/, '')
    .split('(Episode')[0]
    .trim();
  if (historyTitle.endsWith('BD') && !data.episodeList.at(-1)?.title.endsWith('BD')) {
    historyTitle = replaceLast(historyTitle, 'BD', '').trim();
  }
  const lastWatched = useMemo(() => {
    const isLastWatched = historyListsJson.find(
      z => z === `historyItem:${historyTitle}:false:false`,
    );
    if (isLastWatched) {
      return JSON.parse(DatabaseManager.getSync(isLastWatched)!) as HistoryJSON;
    } else return undefined;
  }, [historyListsJson, historyTitle]);

  const scrollRef = useAnimatedRef<FlashListRef<AniDetailEpsList>>();
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

  const [searchQuery, setSearchQuery] = useState('');

  const filteredEpisodes = useMemo(() => {
    if (!searchQuery) return data.episodeList;
    return data.episodeList.toReversed().filter(eps => {
      return eps.title.toLowerCase().includes('episode ' + searchQuery.toLowerCase());
    });
  }, [data.episodeList, searchQuery]);

  const listHeaderComponent = (
    <AniDetailHeader
      data={data}
      historyTitle={historyTitle}
      isInList={isInList}
      lastWatched={lastWatched}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      headerImageStyle={headerImageStyle}
      link={props.route.params.link}
      navigation={props.navigation}
    />
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="height">
      <ReanimatedFlashList
        maintainVisibleContentPosition={{ disabled: true }}
        ref={scrollRef}
        data={filteredEpisodes}
        renderItem={({ item }) => (
          <RenderEpisodeItem
            item={item}
            lastWatched={lastWatched}
            navigation={props.navigation}
            routeTitle={data.title}
          />
        )}
        ItemSeparatorComponent={() => <Divider style={styles.chapterDivider} />}
        keyExtractor={item => item.title}
        contentContainerStyle={{
          backgroundColor: styles.mainContainer.backgroundColor,
          paddingLeft: insets.left,
          paddingRight: insets.right,
          paddingBottom: insets.bottom + 20,
        }}
        ListHeaderComponentStyle={[styles.mainContainer, { marginBottom: 8 }]}
        ListHeaderComponent={listHeaderComponent}
        ListEmptyComponent={
          <View style={[styles.mainContainer, { padding: 20 }]}>
            <Text style={globalStyles.text}>Tidak ada episode</Text>
          </View>
        }
        extraData={colorScheme}
        showsVerticalScrollIndicator={false}
      />
    </KeyboardAvoidingView>
  );
}

interface AniDetailHeaderProps {
  data: Props['route']['params']['data'];
  historyTitle: string;
  isInList: boolean;
  lastWatched: HistoryJSON | undefined;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  headerImageStyle: any;
  link: string;
  navigation: Props['navigation'];
}

const AniDetailHeader = memo(
  ({
    data,
    historyTitle,
    isInList,
    lastWatched,
    searchQuery,
    setSearchQuery,
    headerImageStyle,
    link,
    navigation,
  }: AniDetailHeaderProps) => {
    const styles = useStyles();
    const theme = useTheme();
    const colorScheme = useColorScheme();
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
            colors={['transparent', isDark ? '#0c0c0c' : '#ebebeb']}
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
              resizeMode="contain"
            />
            <View style={styles.infoContainer}>
              <Text style={styles.title} numberOfLines={3}>
                {historyTitle}
              </Text>
              {data.alternativeTitle && (
                <Text style={styles.altTitle} numberOfLines={2}>
                  {data.alternativeTitle}
                </Text>
              )}
              <View style={styles.badgeRow}>
                <View style={[styles.badge, { backgroundColor: isDark ? '#00608d' : '#5ddfff' }]}>
                  <Text style={styles.badgeText}>{data.animeType}</Text>
                </View>
                <View style={[styles.badge, {
                  borderWidth: 1,
                  borderColor: isDark ? '#fff' : '#333',
                  backgroundColor: 'transparent'
                }]}>
                  <Text style={[styles.badgeText, { color: isDark ? '#fff' : '#333' }]}>
                    {data.status}
                  </Text>
                </View>
              </View>
              <Text style={styles.studio}>
                <Icon name="building" size={12} color={styles.studio.color} /> {data.studio}
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

          {/* Info Pills */}
          <View style={styles.additionalInfo}>
            <View style={styles.infoPill}>
              <Icon name="star" size={12} color="#FFD700" />
              <Text style={styles.infoPillText}>{data.rating === '' ? '-' : data.rating}</Text>
            </View>
            <View style={styles.infoPill}>
              <Icon name="calendar" size={12} color={theme.colors.primary} />
              <Text style={styles.infoPillText}>{data.releaseYear}</Text>
            </View>
            <View style={styles.infoPill}>
              <Icon name="play-circle" size={12} color={theme.colors.primary} />
              <Text style={styles.infoPillText}>{data.minutesPerEp}</Text>
            </View>
            <View style={styles.infoPill}>
              <Icon name="eye" size={12} color={theme.colors.primary} />
              <Text style={styles.infoPillText}>
                {data.episodeList.length}/{data.epsTotal} Eps
              </Text>
            </View>
          </View>

          {/* Synopsis */}
          <View style={styles.synopsisContainer}>
            <Text style={styles.sectionTitle}>Sinopsis</Text>
            <Text style={styles.synopsisText}>
              {data.synopsis === '' ? 'Tidak ada sinopsis yang tersedia.' : data.synopsis}
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            {lastWatched && lastWatched.episode && (
              <Button
                mode="contained"
                icon="play"
                style={styles.primaryButton}
                onPress={() => {
                  if (data.episodeList.length > 0) {
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
                  }
                }}>
                Lanjut ({lastWatched.episode.replace(/Subtitle Indonesia|Sub Indo/, '').trim()})
              </Button>
            )}
            <View style={styles.secondaryButtons}>
              <Button
                mode="outlined"
                style={styles.halfButton}
                onPress={() => {
                  if (data.episodeList.length > 0) {
                    navigation.navigate('FromUrl', {
                      title: data.title,
                      link: data.episodeList[data.episodeList.length - 1].link,
                    });
                  }
                }}>
                Ep. Pertama
              </Button>
              <Button
                mode="outlined"
                style={styles.halfButton}
                onPress={() => {
                  if (data.episodeList.length > 0) {
                    navigation.navigate('FromUrl', {
                      title: data.title,
                      link: data.episodeList[0].link,
                    });
                  }
                }}>
                Ep. Terbaru
              </Button>
            </View>
            <Button
              mode="outlined"
              icon="playlist-plus"
              style={styles.watchLaterButton}
              disabled={isInList}
              onPress={() => {
                const watchLaterJson: watchLaterJSON = {
                  title: data.title.replace(/Subtitle Indonesia|Sub Indo/, ''),
                  link: link,
                  rating: data.rating,
                  releaseYear: data.releaseYear,
                  thumbnailUrl: data.thumbnailUrl,
                  genre: data.genres,
                  date: Date.now(),
                };
                controlWatchLater('add', watchLaterJson);
                ToastAndroid.show('Ditambahkan ke tonton nanti', ToastAndroid.SHORT);
              }}>
              {isInList ? 'Sudah di Tonton Nanti' : 'Tonton Nanti'}
            </Button>
          </View>

          {/* Episode List Header + Search */}
          <View style={styles.episodeListHeader}>
            <Text style={styles.sectionTitle}>Daftar Episode</Text>
            <Text style={styles.episodeCount}>{data.episodeList.length}/{data.epsTotal} Episode</Text>
          </View>
          <Searchbar
            keyboardType="number-pad"
            placeholder="Cari Episode"
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchbar}
          />
        </View>
      </View>
    );
  },
);

interface RenderEpisodeItemProps {
  item: AniDetailEpsList;
  lastWatched: HistoryJSON | undefined;
  navigation: Props['navigation'];
  routeTitle: string;
}

const RenderEpisodeItem = memo(
  ({ item, lastWatched, navigation, routeTitle }: RenderEpisodeItemProps) => {
    const styles = useStyles();
    const theme = useTheme();

    const isLastWatched =
      lastWatched && lastWatched.episode && item.title.includes(lastWatched?.episode);

    return (
      <TouchableOpacity
        style={[styles.episodeButton, isLastWatched && styles.lastWatchedButton]}
        onPress={() => {
          navigation.navigate('FromUrl', {
            title: routeTitle,
            link: item.link,
            historyData: isLastWatched
              ? {
                  lastDuration: lastWatched.lastDuration ?? 0,
                  resolution: lastWatched.resolution ?? '',
                }
              : undefined,
          });
        }}>
        <View style={styles.episodeTitleContainer}>
          <Text
            style={[
              styles.episodeText,
              isLastWatched && { color: theme.colors.primary },
            ]}>
            {item.title.replace(/Subtitle Indonesia|Sub Indo/, '').trim()}
          </Text>
          {isLastWatched && (
            <Text style={styles.lastWatchedTag}>● Terakhir Ditonton</Text>
          )}
        </View>
        <Icon
          name={isLastWatched ? 'history' : 'play-circle'}
          size={20}
          color={isLastWatched ? theme.colors.primary : '#888'}
        />
      </TouchableOpacity>
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
          backgroundColor: isDark ? '#0c0c0c' : '#ebebeb',
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
        altTitle: {
          fontSize: 13,
          color: isDark ? '#aaa' : '#777',
          lineHeight: 18,
        },
        badgeRow: {
          flexDirection: 'row',
          gap: 6,
          flexWrap: 'wrap',
        },
        badge: {
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
        additionalInfo: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
        },
        infoPill: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          backgroundColor: theme.colors.secondaryContainer,
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: 20,
        },
        infoPillText: {
          fontSize: 12,
          fontWeight: 'bold',
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
          paddingBottom: 4,
        },
        episodeCount: {
          fontSize: 13,
          color: isDark ? '#888' : '#999',
        },
        searchbar: {
          borderRadius: 12,
          marginBottom: 4,
        },
        episodeButton: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 14,
          paddingHorizontal: 16,
          backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
          gap: 12,
        },
        lastWatchedButton: {
          backgroundColor: isDark ? '#1a2a1a' : '#f0fff0',
        },
        episodeTitleContainer: {
          flex: 1,
        },
        episodeText: {
          fontSize: 14,
          fontWeight: '600',
          color: isDark ? '#e0e0e0' : '#333',
        },
        lastWatchedTag: {
          fontSize: 10,
          fontWeight: 'bold',
          color: theme.colors.primary,
          marginTop: 2,
        },
        lastWatchedTextColor: {
          color: theme.colors.onPrimaryContainer,
        },
        chapterDivider: {
          backgroundColor: isDark ? '#2b2b2b' : '#e0e0e0',
          height: 0.8,
        },
      }),
    [
      isDark,
      colorScheme,
      dimensions.width,
      globalStyles.text.color,
      theme.colors.onPrimaryContainer,
      theme.colors.onSecondaryContainer,
      theme.colors.secondaryContainer,
      theme.colors.primary,
    ],
  );
}

export default memo(AniDetail);
