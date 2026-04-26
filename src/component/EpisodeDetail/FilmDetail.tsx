import { Dropdown } from '@pirles/react-native-element-dropdown';
import Icon from '@react-native-vector-icons/fontawesome';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FlashList, FlashListRef } from '@shopify/flash-list';
import { RecyclerViewProps } from '@shopify/flash-list/dist/recyclerview/RecyclerViewProps';
import { LinearGradient } from 'expo-linear-gradient';
import tr from 'googletrans';
import moment from 'moment';
import { memo, useCallback, useMemo, useState } from 'react';
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
import { ActivityIndicator, Button, Chip, Divider, Surface, useTheme } from 'react-native-paper';
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
import DialogManager from '@utils/dialogManager';
import {
  FilmDetail_Stream,
  FilmDetails_Detail,
  FilmEpisode,
  getFilmSeasonDetails,
} from '@utils/scrapers/film';
import { setFilmStreamHistory } from '@utils/setFilmStreamHistory';
import controlWatchLater from '@utils/watchLaterControl';

type RecyclerViewType = (
  props: RecyclerViewProps<FilmEpisode> & {
    ref?: React.Ref<FlashListRef<FilmEpisode>>;
  },
) => React.JSX.Element;
const ReanimatedFlashList = Reanimated.createAnimatedComponent<RecyclerViewType>(FlashList);

type Props = NativeStackScreenProps<RootStackNavigator, 'FilmDetail'>;

const IMG_HEADER_HEIGHT = 250;

function useCompatibleData(rawData: FilmDetails_Detail | FilmDetail_Stream) {
  return useMemo(() => {
    return 'info' in rawData
      ? rawData
      : {
          info: {
            ...rawData,
            additionalInfo: {
              Rating: rawData.rating,
              ['Resolusi']: rawData.variants?.map(a => a.name).join(', '),
              ['Director']: rawData.director,
              ['Bahasa']: rawData.originalLanguage,
              ['Negara']: rawData.country,
              ['Kualitas']: rawData.quality,
            },
          },
          ...rawData,
        };
  }, [rawData]);
}

function isEpisode(data: FilmDetails_Detail | FilmDetail_Stream): data is FilmDetails_Detail {
  return 'defaultSeason' in data;
}

function FilmDetail(props: Props) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();

  const data = useCompatibleData(props.route.params.data);

  const watchLaterListsJson = useModifiedKeyValueIfFocused(
    'watchLater',
    state => JSON.parse(state) as watchLaterJSON[],
  );
  const isInList = watchLaterListsJson.some(
    item => item.title === data.info.title.split(': Season')[0] && item.isMovie,
  );

  const historyListsJson = useModifiedKeyValueIfFocused(
    'historyKeyCollectionsOrder',
    state => JSON.parse(state) as HistoryItemKey[],
  );
  const historyTitle = data.info.title.split(': Season')[0].trim();
  const lastWatched = useMemo(() => {
    const isLastWatched = historyListsJson.find(
      z => z === `historyItem:${historyTitle}:false:true`,
    );
    if (isLastWatched) {
      return JSON.parse(DatabaseManager.getSync(isLastWatched)!) as HistoryJSON;
    } else return undefined;
  }, [historyListsJson, historyTitle]);

  const lastWatchedEpisodeData = useMemo(() => {
    if (!lastWatched) return undefined;
    if (!isEpisode(data)) {
      return {
        episodeNumber: lastWatched.episode,
        episodeTitle: '',
        episodeUrl: lastWatched.link,
      };
    }
    if (!lastWatched.episode) return undefined;
    return {
      episodeNumber: lastWatched.episode,
      episodeTitle: '',
      episodeUrl: lastWatched.link,
    };
  }, [lastWatched, data]);

  const scrollRef = useAnimatedRef<FlashListRef<FilmEpisode>>();
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

  const [translatedSynopsis, setTranslatedSynopsis] = useState<null | string>(null);
  const [isSynopsisTranslationPending, setIsSynopsisTranslationPending] = useState(false);
  const translateSynopsisToIndonesia = useCallback(async () => {
    setIsSynopsisTranslationPending(true);
    try {
      const translationResult = (await tr(data.info.synopsis, 'id')).text;
      setTranslatedSynopsis(translationResult);
    } catch {
      setTranslatedSynopsis(null);
      ToastAndroid.show('Translate gagal', ToastAndroid.SHORT);
    } finally {
      setIsSynopsisTranslationPending(false);
    }
  }, [data.info.synopsis]);

  const [selectedSeason, setSelectedSeason] = useState(
    isEpisode(data) ? data.defaultSeason.seasonNumber : 1,
  );
  const mappedSeasons = useMemo(() => {
    if (isEpisode(data)) {
      return data.seasons.map(s => ({
        label: `Season ${s}`,
        value: s,
      }));
    }
    return [];
  }, [data]);

  const [currentEpisodeList, setCurrentEpisodeList] = useState(
    isEpisode(data) ? data.defaultSeason.episodes : [],
  );

  const listHeaderComponent = (
    <FilmDetailHeader
      data={data}
      headerImageStyle={headerImageStyle}
      isSynopsisTranslationPending={isSynopsisTranslationPending}
      translatedSynopsis={translatedSynopsis}
      translateSynopsisToIndonesia={translateSynopsisToIndonesia}
      lastWatchedEpisodeData={lastWatchedEpisodeData}
      lastWatched={lastWatched}
      isInList={isInList}
      mappedSeasons={mappedSeasons}
      selectedSeason={selectedSeason}
      setSelectedSeason={setSelectedSeason}
      setCurrentEpisodeList={setCurrentEpisodeList}
      currentEpisodeListLength={currentEpisodeList.length}
      link={props.route.params.link}
      navigation={props.navigation}
    />
  );

  const episodeList = useMemo(() => {
    if (!isEpisode(data))
      return [
        {
          type: 'episode',
          episodeNumber: '',
          episodeTitle: '',
          episodeId: '',
          episodeUrl: props.route.params.link,
          episodeImage: 'coverImage' in data.info ? data.info.coverImage : data.info.thumbnailUrl,
          releaseDate: data.info.releaseDate,
        } as FilmEpisode,
      ];
    return currentEpisodeList;
  }, [data, props.route.params.link, currentEpisodeList]);

  const handlePlayNow = useCallback(() => {
    if (isEpisode(data)) return;
    let historyData: { lastDuration: number; resolution: string } | undefined;
    const startFilm = () => {
      setFilmStreamHistory(props.route.params.link, data, historyData);
      props.navigation.navigate('Video_Film', {
        data,
        link: props.route.params.link,
        historyData,
      });
    };
    if (lastWatched) {
      DialogManager.alert(
        'Lanjutkan durasi?',
        'Kamu sudah menonton film ini sebelumnya. Apakah kamu ingin melanjutkan dari durasi terakhir yang kamu tonton?',
        [
          {
            text: 'Mulai dari awal',
            onPress: () => {
              historyData = undefined;
              startFilm();
            },
          },
          {
            text: 'Lanjutkan',
            onPress: () => {
              historyData = {
                lastDuration: lastWatched?.lastDuration ?? 0,
                resolution: lastWatched?.resolution ?? '',
              };
              startFilm();
            },
          },
        ],
      );
      return;
    }
    startFilm();
  }, [data, lastWatched, props.navigation, props.route.params.link]);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="height">
      <ReanimatedFlashList
        ref={scrollRef}
        data={episodeList}
        renderItem={({ item, index }) => (
          <RenderFilmItem
            item={item}
            index={index}
            totalEps={currentEpisodeList.length}
            data={data}
            lastWatched={lastWatched}
            handlePlayNow={handlePlayNow}
            link={props.route.params.link}
            navigation={props.navigation}
          />
        )}
        ItemSeparatorComponent={() => <Divider style={styles.chapterDivider} />}
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
    </KeyboardAvoidingView>
  );
}

interface FilmDetailHeaderProps {
  data: ReturnType<typeof useCompatibleData>;
  headerImageStyle: any;
  isSynopsisTranslationPending: boolean;
  translatedSynopsis: string | null;
  translateSynopsisToIndonesia: () => void;
  lastWatchedEpisodeData:
    | { episodeNumber: string | null; episodeTitle: string; episodeUrl: string }
    | undefined;
  lastWatched: HistoryJSON | undefined;
  isInList: boolean;
  mappedSeasons: { label: string; value: number }[];
  selectedSeason: number;
  setSelectedSeason: (season: number) => void;
  setCurrentEpisodeList: (episodes: FilmEpisode[]) => void;
  currentEpisodeListLength: number;
  link: string;
  navigation: Props['navigation'];
}

const FilmDetailHeader = memo(
  ({
    data,
    headerImageStyle,
    isSynopsisTranslationPending,
    translatedSynopsis,
    translateSynopsisToIndonesia,
    lastWatchedEpisodeData,
    lastWatched,
    isInList,
    mappedSeasons,
    selectedSeason,
    setSelectedSeason,
    setCurrentEpisodeList,
    currentEpisodeListLength,
    link,
    navigation,
  }: FilmDetailHeaderProps) => {
    const styles = useStyles();
    const theme = useTheme();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

    return (
      <View style={styles.mainContainer}>
        {/* Hero Image */}
        <Reanimated.View style={[{ width: '100%', height: IMG_HEADER_HEIGHT }, headerImageStyle]}>
          <ImageLoading
            source={{ uri: data.info.backgroundImage }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['transparent', isDark ? '#0c0c0c' : '#f5f5f5']}
            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 120 }}
          />
        </Reanimated.View>

        {/* Main Content */}
        <View style={styles.mainContent}>
          {/* Poster + Info Row */}
          <View style={styles.posterRow}>
            <ImageLoading
              source={{ uri: 'coverImage' in data.info ? data.info.coverImage : data.info.thumbnailUrl }}
              style={styles.thumbnail}
              resizeMode="contain"
            />
            <View style={styles.infoContainer}>
              <Text style={styles.title} numberOfLines={3}>
                {data.info.title.trim()}
              </Text>

              {/* Type Badge */}
              <View style={styles.badgeRow}>
                <View style={[styles.badge, { backgroundColor: isDark ? '#00608d' : '#5ddfff' }]}>
                  <Text style={styles.badgeText}>
                    {data.type === 'stream' ? 'Film' : 'Series'}
                  </Text>
                </View>
              </View>

              {/* Genres */}
              <View style={styles.genreContainer}>
                {data.info.genres.slice(0, 3).map(genre => (
                  <Chip key={genre} compact style={styles.genreChip} textStyle={styles.genreText}>
                    {genre}
                  </Chip>
                ))}
              </View>
            </View>
          </View>

          {/* Info Pills */}
          <View style={styles.infoPillRow}>
            {Object.entries(data.info.additionalInfo)
              .filter(([, v]) => Boolean(v))
              .slice(0, 4)
              .map(([key, value]) => (
                <View key={key} style={styles.infoPill}>
                  <Icon name="info-circle" size={11} color={theme.colors.primary} />
                  <Text style={styles.infoPillText}>{key}: {value}</Text>
                </View>
              ))}
            <View style={styles.infoPill}>
              <Icon name="calendar" size={11} color={theme.colors.primary} />
              <Text style={styles.infoPillText}>{data.info.releaseDate}</Text>
            </View>
            {!isEpisode(data) && data.subtitleLink === undefined && (
              <View style={[styles.infoPill, { backgroundColor: theme.colors.errorContainer }]}>
                <Icon name="exclamation-circle" size={11} color={theme.colors.error} />
                <Text style={[styles.infoPillText, { color: theme.colors.error }]}>Tanpa Subtitle</Text>
              </View>
            )}
          </View>

          {/* Synopsis */}
          <View style={styles.synopsisContainer}>
            <View style={styles.synopsisHeader}>
              <Text style={styles.sectionTitle}>Sinopsis</Text>
              {!(isSynopsisTranslationPending || translatedSynopsis !== null) && (
                <Button icon="google-translate" mode="outlined" compact onPress={translateSynopsisToIndonesia}>
                  Terjemahkan
                </Button>
              )}
              {isSynopsisTranslationPending && <ActivityIndicator size={16} />}
            </View>
            <Text style={styles.synopsisText}>
              {data.info.synopsis === ''
                ? 'Tidak ada sinopsis yang tersedia.'
                : (translatedSynopsis ?? data.info.synopsis)}
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            {lastWatchedEpisodeData && lastWatched && (
              <Button
                icon="play-circle"
                mode="contained"
                style={styles.primaryButton}
                onPress={() => {
                  if (!isEpisode(data)) {
                    setFilmStreamHistory(link, data, {
                      lastDuration: lastWatched.lastDuration ?? 0,
                      resolution: lastWatched.resolution ?? '',
                    });
                    navigation.navigate('Video_Film', {
                      data,
                      link: lastWatched.link,
                      historyData: {
                        lastDuration: lastWatched.lastDuration ?? 0,
                        resolution: lastWatched.resolution ?? '',
                      },
                    });
                    return;
                  }
                  navigation.navigate('FromUrl', {
                    title: data.info.title,
                    link: lastWatchedEpisodeData.episodeUrl,
                    historyData: {
                      lastDuration: lastWatched.lastDuration ?? 0,
                      resolution: lastWatched.resolution ?? '',
                    },
                    type: 'film',
                  });
                }}>
                Lanjutkan:{' '}
                {isEpisode(data)
                  ? lastWatchedEpisodeData.episodeNumber
                  : moment.utc((lastWatched.lastDuration ?? 0) * 1000).format('HH:mm:ss')}
              </Button>
            )}
            <Button
              icon="playlist-plus"
              mode="outlined"
              style={styles.watchLaterButton}
              disabled={isInList}
              onPress={() => {
                const watchLaterJson: watchLaterJSON = {
                  title: data.info.title.trim(),
                  link: link,
                  rating: 'Film',
                  releaseYear: data.info.releaseDate,
                  thumbnailUrl: 'coverImage' in data.info ? data.info.coverImage : data.info.thumbnailUrl,
                  genre: data.info.genres,
                  date: Date.now(),
                  isMovie: true,
                };
                controlWatchLater('add', watchLaterJson);
                ToastAndroid.show('Ditambahkan ke tonton nanti', ToastAndroid.SHORT);
              }}>
              {isInList ? 'Sudah di Tonton Nanti' : 'Tonton Nanti'}
            </Button>
          </View>

          {/* Season Dropdown */}
          {isEpisode(data) && (
            <View style={styles.seasonContainer}>
              <View style={styles.episodeListHeader}>
                <Text style={styles.sectionTitle}>Daftar Episode</Text>
                <Dropdown
                  data={mappedSeasons}
                  value={selectedSeason}
                  placeholder="Pilih Season"
                  valueField="value"
                  labelField="label"
                  onChange={item => {
                    setSelectedSeason(item.value);
                    getFilmSeasonDetails(link + '/season/' + item.value).then(a =>
                      setCurrentEpisodeList(a.episodes),
                    );
                  }}
                  style={styles.dropdownStyle}
                  containerStyle={styles.dropdownContainerStyle}
                  itemTextStyle={styles.dropdownItemTextStyle}
                  itemContainerStyle={styles.dropdownItemContainerStyle}
                  activeColor={theme.colors.secondaryContainer}
                  selectedTextStyle={styles.dropdownSelectedTextStyle}
                  placeholderStyle={styles.dropdownPlaceholderStyle}
                  iconStyle={styles.dropdownIconStyle}
                  autoScroll
                  dropdownPosition={currentEpisodeListLength < 5 ? 'top' : 'auto'}
                />
              </View>
            </View>
          )}
        </View>
      </View>
    );
  },
);

interface RenderFilmItemProps {
  item: FilmEpisode;
  index: number;
  totalEps: number;
  data: ReturnType<typeof useCompatibleData>;
  lastWatched: HistoryJSON | undefined;
  handlePlayNow: () => void;
  link: string;
  navigation: Props['navigation'];
}

const RenderFilmItem = memo(
  ({ item, index, totalEps, data, lastWatched, handlePlayNow, navigation }: RenderFilmItemProps) => {
    const styles = useStyles();
    const theme = useTheme();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

    if (!isEpisode(data)) {
      return (
        <View style={{ padding: 12 }}>
          <Button
            icon="movie-open-play"
            mode="contained"
            style={{ borderRadius: 10 }}
            onPress={handlePlayNow}>
            Tonton Sekarang
          </Button>
        </View>
      );
    }

    const episodeLastWatchedModified =
      lastWatched &&
      lastWatched.episode &&
      lastWatched.episode.replace('Season ', '').trim().replace('Episode', '-').trim();
    const isEpisodeLastWatched =
      lastWatched &&
      episodeLastWatchedModified &&
      item.episodeNumber === episodeLastWatchedModified;

    return (
      <TouchableOpacity
        style={[styles.episodeButton, isEpisodeLastWatched && styles.lastWatchedButton]}
        onPress={() => {
          navigation.navigate('FromUrl', {
            title: data.info.title,
            link: item.episodeUrl,
            historyData: isEpisodeLastWatched
              ? {
                  lastDuration: lastWatched.lastDuration ?? 0,
                  resolution: lastWatched.resolution ?? '',
                }
              : undefined,
            type: 'film',
          });
        }}>

        {/* Episode Number Badge */}
        <View style={[
          styles.epNumberBadge,
          isEpisodeLastWatched && { backgroundColor: theme.colors.primary }
        ]}>
          <Text style={[
            styles.epNumberText,
            isEpisodeLastWatched && { color: '#fff' }
          ]}>
            {item.episodeNumber || String(index + 1)}
          </Text>
        </View>

        {/* Episode Info */}
        <View style={styles.episodeTitleWrapper}>
          <Text
            numberOfLines={1}
            style={[
              styles.episodeText,
              isEpisodeLastWatched && { color: theme.colors.primary },
            ]}>
            {item.episodeTitle || `Episode ${item.episodeNumber}`}
          </Text>
          {item.releaseDate ? (
            <Text style={styles.episodeDate}>{item.releaseDate}</Text>
          ) : null}
          {isEpisodeLastWatched && (
            <Text style={styles.lastWatchedTag}>● Terakhir Ditonton</Text>
          )}
        </View>

        {/* Play Button */}
        <View style={[
          styles.playButton,
          isEpisodeLastWatched && { backgroundColor: theme.colors.primaryContainer }
        ]}>
          <Icon
            name={isEpisodeLastWatched ? 'history' : 'play'}
            size={13}
            color={isEpisodeLastWatched ? theme.colors.primary : isDark ? '#aaa' : '#666'}
          />
        </View>
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
        genreContainer: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 4,
        },
        genreChip: {
          backgroundColor: theme.colors.secondaryContainer,
          height: 26,
        },
        genreText: {
          fontSize: 10,
          color: theme.colors.onSecondaryContainer,
        },
        infoPillRow: {
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
          fontSize: 11,
          fontWeight: 'bold',
          color: theme.colors.onSecondaryContainer,
        },
        synopsisContainer: {
          gap: 8,
        },
        synopsisHeader: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
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
        watchLaterButton: {
          borderRadius: 10,
        },
        seasonContainer: {
          width: '100%',
        },
        episodeListHeader: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: 4,
        },
        // Dropdown styles
        dropdownStyle: {
          backgroundColor: theme.colors.elevation.level2,
          paddingHorizontal: 12,
          paddingVertical: 8,
          minWidth: dimensions.width * 0.38,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant || (isDark ? '#444' : '#E0E0E0'),
        },
        dropdownContainerStyle: {
          borderRadius: 12,
          backgroundColor: theme.colors.elevation.level3,
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant || (isDark ? '#444' : '#E0E0E0'),
          overflow: 'hidden',
          elevation: 6,
        },
        dropdownItemTextStyle: {
          color: theme.colors.onSurface,
          fontSize: 14,
          fontWeight: '500',
        },
        dropdownItemContainerStyle: {
          paddingHorizontal: 12,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.colors.outlineVariant || (isDark ? '#333' : '#E0E0E0'),
        },
        dropdownSelectedTextStyle: {
          color: theme.colors.primary,
          fontSize: 14,
          fontWeight: 'bold',
        },
        dropdownPlaceholderStyle: {
          color: globalStyles.text.color,
          fontSize: 14,
          opacity: 0.7,
        },
        dropdownIconStyle: {
          tintColor: theme.colors.onSurface,
          width: 22,
          height: 22,
        },
        // Episode item styles - matching AniDetail
        episodeButton: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 12,
          paddingHorizontal: 16,
          backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
          gap: 12,
        },
        lastWatchedButton: {
          backgroundColor: isDark ? '#1a2a1a' : '#f0fff0',
        },
        epNumberBadge: {
          width: 36,
          height: 36,
          borderRadius: 8,
          backgroundColor: isDark ? '#2a2a2a' : '#e8e8e8',
          justifyContent: 'center',
          alignItems: 'center',
        },
        epNumberText: {
          fontSize: 12,
          fontWeight: 'bold',
          color: isDark ? '#ccc' : '#555',
        },
        episodeTitleWrapper: {
          flex: 1,
        },
        episodeText: {
          fontSize: 13,
          fontWeight: '600',
          color: isDark ? '#e0e0e0' : '#333',
        },
        episodeDate: {
          fontSize: 11,
          color: isDark ? '#666' : '#aaa',
          marginTop: 2,
        },
        lastWatchedTag: {
          fontSize: 10,
          fontWeight: 'bold',
          color: theme.colors.primary,
          marginTop: 2,
        },
        playButton: {
          width: 30,
          height: 30,
          borderRadius: 15,
          backgroundColor: isDark ? '#2a2a2a' : '#e8e8e8',
          justifyContent: 'center',
          alignItems: 'center',
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
      theme.colors,
    ],
  );
}

export default memo(FilmDetail);
