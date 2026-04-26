import Icon from '@react-native-vector-icons/fontawesome';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps, StackActions, useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FlashList, ListRenderItemInfo } from '@shopify/flash-list';
import React, { memo, useCallback, useMemo, useRef, useState, useTransition } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  StyleSheet,
  Text,
  TextInput as TextInputType,
  ToastAndroid,
  TouchableOpacity as TouchableOpacityReactNative,
  View,
  useColorScheme,
} from 'react-native';
import { Searchbar, SegmentedButtons, Snackbar, useTheme } from 'react-native-paper';
import Reanimated, {
  FadeInRight,
  FadeInUp,
  LinearTransition,
  ZoomIn,
  ZoomOut,
} from 'react-native-reanimated';

import { SearchAnime, listAnimeTypeList } from '@/types/anime';
import { HomeNavigator, RootStackNavigator } from '@/types/navigation';
import proTips from '@assets/proTips.json';
import useGlobalStyles from '@assets/style';
import DarkOverlay from '@component/misc/DarkOverlay';
import ImageLoading from '@component/misc/ImageLoading';
import { TouchableOpacity } from '@component/misc/TouchableOpacityRNGH';
import AnimeAPI from '@utils/AnimeAPI';
import { DatabaseManager, useModifiedKeyValueIfFocused } from '@utils/DatabaseManager';
import DialogManager from '@utils/dialogManager';
import { Movies, searchMovie } from '@utils/scrapers/animeMovie';
import { ComicsSearch, comicsSearch } from '@utils/scrapers/comicsv2';
import { SearchResult, searchFilm } from '@utils/scrapers/film';
import { __ALIAS as KomikuAlias, KomikuSearch, komikuSearch } from '@utils/scrapers/komiku';
import { RenderScrollComponent } from './AnimeList';

type SectionHeader = { type: 'header'; title: string };
type ComicItem = (ComicsSearch | KomikuSearch) & { source?: string };
type ComicsComboSearch = ComicItem | SectionHeader;
type AnySearchItem = Movies | SearchAnimeResult | ComicsComboSearch | SearchResult[number];
type SearchRowItem = Exclude<AnySearchItem, SectionHeader>;

const TouchableOpacityAnimated = Reanimated.createAnimatedComponent(TouchableOpacity);
const Reanimated_KeyboardAvoidingView = Reanimated.createAnimatedComponent(KeyboardAvoidingView);

type Props = CompositeScreenProps<
  BottomTabScreenProps<HomeNavigator, 'Search'>,
  NativeStackScreenProps<RootStackNavigator>
>;

function Search(props: Props) {
  const [isPending, startTransition] = useTransition();
  const globalStyles = useGlobalStyles();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const styles = useStyles();
  const theme = useTheme();

  const [searchType, setSearchType] = useState<'anime' | 'comics' | 'film'>('anime');
  const [searchedSearchType, setSearchedSearchType] = useState(searchType);
  const textInputRef = useRef<TextInputType>(null);
  const isFocus = useRef(true);

  useFocusEffect(
    useCallback(() => {
      const timeout = setTimeout(() => { isFocus.current = true; }, 200);
      const keyboardEvent = Keyboard.addListener('keyboardDidHide', () => {
        textInputRef.current?.blur();
      });
      return () => {
        isFocus.current = false;
        keyboardEvent.remove();
        clearTimeout(timeout);
        setShowSearchHistory(false);
      };
    }, []),
  );

  const [searchText, setSearchText] = useState('');
  const [listAnime, setListAnime] = useState<listAnimeTypeList[] | null>(null);
  const [listAnimeLoading, setListAnimeLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [data, setData] = useState<null | SearchAnime>(null);
  const [movieData, setMovieData] = useState<null | Movies[]>(null);
  const [filmData, setFilmData] = useState<null | SearchResult>(null);
  const [comicsData, setComicsData] = useState<null | ComicsComboSearch[]>(null);
  const [loading, setLoading] = useState(false);
  const [currentSearchQuery, setCurrentSearchQuery] = useState('');
  const [showSearchHistory, setShowSearchHistory] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (showSearchHistory) {
        const backAction = () => {
          setShowSearchHistory(false);
          textInputRef.current?.blur();
          return true;
        };
        const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
        return () => backHandler.remove();
      }
    }, [showSearchHistory]),
  );

  const searchHistory = useModifiedKeyValueIfFocused(
    'searchHistory',
    result => JSON.parse(result) as string[],
  );

  const abortController = useRef<AbortController | null>(null);
  abortController.current ??= new AbortController();

  const loadAnimeList = useCallback(() => {
    setListAnimeLoading(true);
    setIsError(false);
    setListAnime([]);
    AnimeAPI.listAnime(undefined, animeData => {
      startTransition(() => setListAnime(animeData));
    })
      .then(animeData => setListAnime(animeData))
      .catch(() => {
        setListAnime(null);
        setIsError(true);
        ToastAndroid.show('Gagal memuat daftar anime', ToastAndroid.SHORT);
      })
      .finally(() => setListAnimeLoading(false));
  }, []);

  const onChangeText = useCallback((text: string) => setSearchText(text), []);

  const submit = useCallback(() => {
    const handleError = (err: Error) => {
      if (err.message.includes('Aborted') || err.message.includes('canceled')) return;
      if (err.message === 'Silahkan selesaikan captcha') {
        return ToastAndroid.show('Silahkan selesaikan captcha', ToastAndroid.SHORT);
      }
      const errMessage =
        err.message === 'Network Error'
          ? 'Permintaan gagal.\nPastikan kamu terhubung dengan internet'
          : 'Error tidak diketahui: ' + err.message;
      DialogManager.alert('Error', errMessage);
    };

    if (searchText.trim() === '') return;

    setShowSearchHistory(false);
    setLoading(true);
    textInputRef.current?.blur();

    const saveHistory = () => {
      if (searchHistory.includes(searchText.trim())) {
        searchHistory.splice(searchHistory.indexOf(searchText.trim()), 1);
      }
      searchHistory.unshift(searchText.trim());
      DatabaseManager.set('searchHistory', JSON.stringify(searchHistory));
    };

    if (searchType === 'anime') {
      Promise.all([
        AnimeAPI.search(searchText, abortController.current?.signal),
        searchMovie(searchText, abortController.current?.signal),
      ])
        .then(([animeResult, movieResult]) => {
          setCurrentSearchQuery(searchText);
          setFilmData(null);
          setComicsData(null);
          if (!('isError' in movieResult)) setMovieData(movieResult);
          setData(animeResult);
        })
        .finally(() => {
          setSearchedSearchType(searchType);
          saveHistory();
          setLoading(false);
        })
        .catch(handleError);
    } else if (searchType === 'film') {
      searchFilm(searchText, abortController.current?.signal)
        .then(result => {
          setData(null);
          setMovieData(null);
          setComicsData(null);
          setFilmData(result);
        })
        .catch(handleError)
        .finally(() => {
          setSearchedSearchType(searchType);
          saveHistory();
          setCurrentSearchQuery(searchText.trim());
          setLoading(false);
        });
    } else {
      Promise.allSettled([
        comicsSearch(searchText, abortController.current?.signal),
        komikuSearch(searchText, abortController.current?.signal),
      ])
        .then(([comicsResponse, komikuResponse]) => {
          if (comicsResponse.status === 'rejected' && komikuResponse.status === 'rejected') {
            throw new Error(comicsResponse.reason);
          }
          const comicsResult = comicsResponse.status === 'fulfilled' ? comicsResponse.value : [];
          const komikuResult = komikuResponse.status === 'fulfilled' ? komikuResponse.value : [];
          setData(null);
          setMovieData(null);
          setFilmData(null);

          const allItems: ComicItem[] = [
            ...comicsResult,
            ...komikuResult.map(res => ({ ...res, source: KomikuAlias })),
          ];
          const grouped: { [key: string]: ComicItem[] } = {};
          allItems.forEach(item => {
            const src = item.source || 'Lainnya';
            if (!grouped[src]) grouped[src] = [];
            grouped[src].push(item);
          });
          const sectionedData: ComicsComboSearch[] = [];
          Object.keys(grouped).forEach(key => {
            sectionedData.push({ type: 'header', title: key });
            sectionedData.push(...grouped[key]);
          });
          setComicsData(sectionedData);
        })
        .catch(handleError)
        .finally(() => {
          setSearchedSearchType(searchType);
          saveHistory();
          setCurrentSearchQuery(searchText.trim());
          setLoading(false);
        });
    }
  }, [searchHistory, searchText, searchType]);

  function renderSearchHistory({ item, index }: ListRenderItemInfo<string>) {
    return (
      <HistoryList
        index={index}
        item={item}
        onChangeTextFunction={onChangeText}
      />
    );
  }

  const listAnimeRenderer = useCallback(
    ({ index, item }: ListRenderItemInfo<listAnimeTypeList>) => (
      <TouchableOpacity
        onPress={() => {
          props.navigation.dispatch(
            StackActions.push('FromUrl', { title: item.title, link: item.streamingLink }),
          );
        }}
        style={styles.animeList}>
        <Text style={[globalStyles.text, styles.animeListIndex]}>{index + 1}.</Text>
        <Text numberOfLines={1} style={[globalStyles.text, styles.animeListTitle]}>
          {item?.title}
        </Text>
      </TouchableOpacity>
    ),
    [globalStyles.text, props.navigation, styles],
  );

  const onTextInputFocus = useCallback(() => {
    if (!isFocus.current) {
      textInputRef.current?.blur();
      isFocus.current = true;
      return;
    }
    setShowSearchHistory(true);
  }, []);

  const hasSearchResults =
    (data?.result?.length ?? 0) > 0 ||
    (movieData && movieData.length > 0) ||
    (comicsData && comicsData.length > 0) ||
    (filmData && filmData.length > 0);
  const isSearchEmpty =
    !hasSearchResults && (data !== null || comicsData !== null || filmData !== null);
  const isLoading = listAnimeLoading || isPending;
  const showDefaultList =
    !hasSearchResults && !isSearchEmpty && listAnime !== null && listAnime.length > 0;
  const shouldShowManualLoad =
    !hasSearchResults &&
    !isLoading &&
    (listAnime === null || listAnime.length === 0) &&
    data === null &&
    comicsData === null &&
    filmData === null;

  const flashListData: AnySearchItem[] = [
    ...(movieData ?? []),
    ...(data?.result ?? []),
    ...(comicsData ?? []),
    ...(filmData ?? []),
  ];

  return (
    <View style={{ flex: 1 }}>
      {/* Search Bar Row */}
      <View style={styles.searchBarRow}>
        {showSearchHistory && (
          <TouchableOpacityReactNative
            hitSlop={15}
            onPress={() => {
              setShowSearchHistory(false);
              textInputRef.current?.blur();
            }}
            style={styles.backButton}>
            <Icon name="angle-left" size={26} color={theme.colors.primary} />
          </TouchableOpacityReactNative>
        )}
        <Reanimated.View layout={LinearTransition.springify()} style={{ flex: 1 }}>
          <Searchbar
            onSubmitEditing={submit}
            onIconPress={submit}
            onChangeText={onChangeText}
            onFocus={onTextInputFocus}
            placeholder="Cari disini..."
            value={searchText}
            autoCorrect={false}
            ref={textInputRef}
            style={styles.searchBar}
            inputStyle={{ fontSize: 14 }}
          />
        </Reanimated.View>
      </View>

      {/* Segment */}
      <SegmentedButtons
        style={styles.segmentedButtons}
        value={searchType}
        onValueChange={setSearchType}
        buttons={[
          { value: 'anime', label: 'Anime', icon: 'movie-search' },
          { value: 'comics', label: 'Komik', icon: 'book-search' },
          { value: 'film', label: 'Film', icon: 'movie' },
        ]}
      />

      {/* Loading indicator */}
      {isLoading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={[globalStyles.text, styles.loadingText]}>Sedang mengambil data...</Text>
        </View>
      )}

      {/* Empty state / manual load */}
      {shouldShowManualLoad && (
        <Reanimated.View entering={FadeInUp} style={styles.center}>
          <View style={styles.emptyStateContainer}>
            <Icon
              name={isError ? 'warning' : 'list-alt'}
              size={56}
              color={isError ? theme.colors.error : theme.colors.outline}
              style={{ marginBottom: 12 }}
            />
            <Text style={[globalStyles.text, styles.emptyStateTitle]}>
              {isError ? 'Gagal Memuat Data' : 'Jelajahi Anime'}
            </Text>
            <Text style={[globalStyles.text, styles.emptyStateSubtitle]}>
              {isError
                ? 'Terjadi kesalahan koneksi. Silahkan coba lagi.'
                : 'Tekan tombol di bawah untuk melihat daftar anime terbaru.'}
            </Text>
            <TouchableOpacityReactNative
              onPress={loadAnimeList}
              activeOpacity={0.7}
              style={[
                styles.loadButton,
                {
                  backgroundColor: isError
                    ? theme.colors.errorContainer
                    : theme.colors.primaryContainer,
                },
              ]}>
              <Icon
                name={isError ? 'refresh' : 'cloud-download'}
                size={16}
                color={isError ? theme.colors.onErrorContainer : theme.colors.onPrimaryContainer}
              />
              <Text
                style={[
                  styles.loadButtonText,
                  {
                    color: isError
                      ? theme.colors.onErrorContainer
                      : theme.colors.onPrimaryContainer,
                  },
                ]}>
                {isError ? 'Coba Lagi' : 'Muat Daftar Anime'}
              </Text>
            </TouchableOpacityReactNative>
          </View>
        </Reanimated.View>
      )}

      {/* Default anime list */}
      {showDefaultList && (
        <View style={{ flex: 1 }}>
          <Text style={[globalStyles.text, styles.totalAnimeText]}>
            Total anime: {listAnime?.length} (belum termasuk movie)
          </Text>
          <FlashList
            data={listAnime}
            renderItem={listAnimeRenderer}
            ItemSeparatorComponent={() => <View style={{ height: 4 }} />}
            keyExtractor={item => item.title}
            extraData={styles}
            contentContainerStyle={{ paddingBottom: 20, paddingTop: 4 }}
          />
        </View>
      )}

      {/* Search results */}
      {(hasSearchResults || isSearchEmpty) && (
        <>
          <View style={styles.resultHeaderRow}>
            <Icon
              name={isSearchEmpty ? 'search-minus' : 'search'}
              size={13}
              color={isSearchEmpty ? theme.colors.error : theme.colors.primary}
            />
            <Text style={[globalStyles.text, styles.resultHeaderText]}>
              {isSearchEmpty
                ? 'Tidak ada hasil untuk pencarian ini'
                : `Hasil: "${currentSearchQuery}"`}
            </Text>
            {!isSearchEmpty && movieData && movieData.length > 0 && (data?.result?.length ?? 0) > 0 && (
              <Text style={styles.movieNoteText}> · Movie di urutan atas</Text>
            )}
          </View>

          {isSearchEmpty && (
            <Reanimated.View entering={FadeInUp} style={styles.center}>
              <View style={styles.emptyStateContainer}>
                <Icon name="search-minus" size={56} color={theme.colors.outline} style={{ marginBottom: 12 }} />
                <Text style={[globalStyles.text, styles.emptyStateTitle]}>Hasil tidak ditemukan</Text>
                <Text style={[globalStyles.text, styles.emptyStateSubtitle]}>
                  Coba periksa kembali kata kunci atau gunakan kata yang lebih umum.
                </Text>
                <View style={{ alignItems: 'flex-start', width: '100%' }}>
                  {proTips[searchedSearchType].map(proTip => (
                    <Text style={[globalStyles.text, styles.proTip]} key={proTip}>
                      <Icon name="lightbulb-o" size={11} color={theme.colors.primary} /> {proTip}
                    </Text>
                  ))}
                </View>
              </View>
            </Reanimated.View>
          )}

          {hasSearchResults && (
            <FlashList
              renderScrollComponent={RenderScrollComponent}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              data={flashListData}
              getItemType={item => {
                if ('type' in item && item.type === 'header') return 'sectionHeader';
                return 'row';
              }}
              keyExtractor={(item, index) => {
                if ('type' in item && item.type === 'header') return `header-${item.title}-${index}`;
                return String(index);
              }}
              renderItem={({ item: z }) => <SearchList item={z} parentProps={props} />}
              contentContainerStyle={{ paddingBottom: 80, paddingHorizontal: 10, paddingTop: 4 }}
              estimatedItemSize={150}
            />
          )}
        </>
      )}

      {/* Search History overlay */}
      {showSearchHistory && (
        <Reanimated_KeyboardAvoidingView
          behavior="height"
          entering={ZoomIn.springify().withInitialValues({ transform: [{ scale: 0.5 }] })}
          exiting={ZoomOut.springify()}
          style={styles.searchHistoryContainer}>
          <View style={{ flex: 1 }}>
            <SegmentedButtons
              value={searchType}
              onValueChange={setSearchType}
              buttons={[
                { value: 'anime', label: 'Anime', icon: 'movie-search' },
                { value: 'comics', label: 'Komik', icon: 'book-search' },
                { value: 'film', label: 'Film', icon: 'movie' },
              ]}
            />
            <FlashList
              drawDistance={250}
              keyboardShouldPersistTaps="always"
              contentContainerStyle={styles.searchHistoryScrollBox}
              data={searchHistory}
              keyExtractor={searchHistoryKeyExtractor}
              extraData={styles}
              renderItem={renderSearchHistory}
              ItemSeparatorComponent={() => (
                <View style={styles.historyDivider} />
              )}
              ListHeaderComponent={() => (
                <View style={styles.searchHistoryHeader}>
                  <Icon name="history" size={14} color={useTheme().colors.primary} />
                  <Text style={[globalStyles.text, styles.historyHeaderText]}>
                    Riwayat Pencarian ({searchHistory.length})
                  </Text>
                </View>
              )}
            />
          </View>
        </Reanimated_KeyboardAvoidingView>
      )}

      {/* Close search result button */}
      {(data !== null || comicsData !== null || filmData !== null) && !loading && (
        <TouchableOpacityAnimated
          style={styles.closeSearchResult}
          onPress={() => {
            setData(null);
            setMovieData(null);
            setComicsData(null);
            setFilmData(null);
          }}
          entering={ZoomIn}
          exiting={ZoomOut}>
          <Icon name="times" size={20} color="#fff" />
        </TouchableOpacityAnimated>
      )}

      <Snackbar
        style={styles.snackbar}
        visible={loading}
        onDismiss={() => setLoading(false)}
        action={{
          label: 'Batal',
          onPress: () => {
            abortController.current?.abort();
            abortController.current = new AbortController();
          },
        }}
        duration={Infinity}>
        Memuat data...
      </Snackbar>
    </View>
  );
}

function HistoryList({
  index,
  item,
  onChangeTextFunction,
}: {
  index: number;
  item: string;
  onChangeTextFunction: (text: string) => void;
}) {
  const theme = useTheme();
  const globalStyles = useGlobalStyles();
  const styles = useStyles();

  return (
    <View
      style={styles.searchHistoryItemContainer}
      pointerEvents="box-none"
      onStartShouldSetResponder={() => true}>
      <TouchableOpacityReactNative
        style={styles.historyItem}
        onPress={() => onChangeTextFunction(item)}>
        <Icon name="history" size={15} color={theme.colors.tertiary} style={{ marginRight: 8 }} />
        <Text style={[globalStyles.text, { flex: 1, fontWeight: '500' }]}>{item}</Text>
        <TouchableOpacityReactNative
          hitSlop={14}
          onPress={async () => {
            DatabaseManager.set(
              'searchHistory',
              JSON.stringify(
                (JSON.parse((await DatabaseManager.get('searchHistory')) ?? '[]') as string[]).filter(
                  (_, i) => i !== index,
                ),
              ),
            );
          }}>
          <Icon name="times-circle" size={18} color="#ff4444" />
        </TouchableOpacityReactNative>
      </TouchableOpacityReactNative>
    </View>
  );
}

type SearchAnimeResult = SearchAnime['result'][number];

function SearchList({ item: z, parentProps: props }: { item: AnySearchItem; parentProps: Props }) {
  const theme = useTheme();
  const globalStyles = useGlobalStyles();
  const styles = useStyles();

  if ('type' in z && z.type === 'header') {
    return (
      <View style={styles.sectionHeaderContainer}>
        <View style={styles.sectionHeaderLine} />
        <Text style={[globalStyles.text, styles.sectionHeaderText]}>
          <Icon name="globe" size={13} color={theme.colors.secondary} /> {z.title.toUpperCase()}
        </Text>
        <View style={styles.sectionHeaderLine} />
      </View>
    );
  }

  const item = z as SearchRowItem;

  const isMovie = (data: SearchRowItem): data is Movies =>
    !('animeUrl' in data) && !('detailUrl' in data) && !('synopsis' in data);
  const isComic = (data: SearchRowItem): data is ComicItem => 'additionalInfo' in data;
  const isAnime = (data: SearchRowItem): data is SearchAnimeResult => 'animeUrl' in data;
  const isFilm = (data: SearchRowItem): data is SearchResult[number] => 'synopsis' in data;

  // Badge config — sinkron sama Home
  const badgeConfig = useMemo(() => {
    if (isMovie(item)) return { label: 'Movie', color: '#a06800' };
    if (isComic(item)) return { label: 'Komik', color: '#0288D1' };
    if (isFilm(item)) return { label: item.type ?? 'Film', color: '#1565c0' };
    if (isAnime(item))
      return {
        label: item.status,
        color: item.status === 'Ongoing' ? '#920000' : '#006600',
      };
    return null;
  }, [item]);

  return (
    <TouchableOpacityAnimated
      entering={FadeInRight}
      style={styles.searchCard}
      activeOpacity={0.8}
      onPress={() => {
        if (!isComic(item) && !isAnime(item) && !isMovie(item) && !isFilm(item)) return;
        props.navigation.dispatch(
          StackActions.push('FromUrl', {
            title: item.title,
            link: isFilm(item)
              ? item.url
              : isMovie(item)
                ? item.url
                : isComic(item)
                  ? item.detailUrl
                  : item.animeUrl,
            type: isFilm(item)
              ? 'film'
              : isMovie(item)
                ? 'movie'
                : isComic(item)
                  ? 'comics'
                  : 'anime',
          }),
        );
      }}>
      {/* Thumbnail dengan badge pojok kiri atas — sinkron sama Home */}
      <View style={styles.searchThumbnailWrapper}>
        <ImageLoading
          resizeMode="cover"
          source={{ uri: item.thumbnailUrl }}
          style={styles.searchThumbnail}
        />
        {badgeConfig && (
          <View style={[styles.searchBadge, { backgroundColor: badgeConfig.color }]}>
            <Text style={styles.searchBadgeText}>{badgeConfig.label}</Text>
          </View>
        )}
        {isAnime(item) && item.rating && (
          <View style={styles.ratingBadge}>
            <Icon name="star" size={9} color="#FFD700" />
            <Text style={styles.ratingBadgeText}> {item.rating}</Text>
          </View>
        )}
        {isFilm(item) && item.rating && (
          <View style={styles.ratingBadge}>
            <Icon name="star" size={9} color="#FFD700" />
            <Text style={styles.ratingBadgeText}> {item.rating}</Text>
          </View>
        )}
      </View>

      {/* Info panel dengan blur bg */}
      <ImageLoading
        displayLoading={false}
        source={{ uri: item.thumbnailUrl }}
        blurRadius={8}
        style={{ flex: 1, borderTopRightRadius: 14, borderBottomRightRadius: 14, overflow: 'hidden' }}>
        <DarkOverlay transparent={0.82} />

        <View style={styles.searchInfoInner}>
          {/* Judul */}
          <Text numberOfLines={2} style={styles.searchTitle}>
            {item.title}{isFilm(item) && item.year !== 'Unknown' ? ` (${item.year})` : ''}
          </Text>

          {/* Synopsis (film only) */}
          {isFilm(item) && item.synopsis ? (
            <Text style={styles.synopsisText} numberOfLines={2}>{item.synopsis}</Text>
          ) : null}

          {/* Tags bawah */}
          <View style={styles.tagRow}>
            {/* Quality / Season (film) */}
            {isFilm(item) && (item.quality || item.numberOfSeasons) && (
              <View style={[styles.tag, { backgroundColor: 'rgb(0,57,80)' }]}>
                <Icon name={item.quality ? 'video-camera' : 'tv'} size={10} color="rgb(220,184,255)" />
                <Text style={styles.tagText}>{item.quality ?? `S${item.numberOfSeasons}`}</Text>
              </View>
            )}
            {/* Genre / Status / concept */}
            {!isMovie(item) && !isFilm(item) && (
              <View style={[styles.tag, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
                <Icon name="tags" size={10} color="#fff" />
                <Text style={styles.tagText} numberOfLines={1}>
                  {isAnime(item)
                    ? item.genres.join(', ')
                    : 'status' in item
                      ? item.status
                      : item.concept}
                </Text>
              </View>
            )}
            {/* Comics additional info */}
            {isComic(item) && (
              <View style={[styles.tag, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
                <Icon name="info" size={10} color="#fff" />
                <Text style={styles.tagText} numberOfLines={1}>{item.additionalInfo}</Text>
              </View>
            )}
            {/* Comics source */}
            {isComic(item) && item.source && (
              <View style={[styles.tag, { backgroundColor: theme.colors.tertiaryContainer }]}>
                <Icon name="globe" size={10} color={theme.colors.onTertiaryContainer} />
                <Text style={[styles.tagText, { color: theme.colors.onTertiaryContainer }]}>
                  {item.source.toUpperCase()}
                </Text>
              </View>
            )}
            {/* Comics latest chapter */}
            {isComic(item) && item.latestChapter && (
              <View style={[styles.tag, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
                <Icon name="book" size={10} color="#fff" />
                <Text style={styles.tagText}>Ch. {item.latestChapter}</Text>
              </View>
            )}
          </View>
        </View>
      </ImageLoading>
    </TouchableOpacityAnimated>
  );
}

function searchHistoryKeyExtractor(name: string, index: number) {
  return name + String(index);
}

function useStyles() {
  const globalStyles = useGlobalStyles();
  const theme = useTheme();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return useMemo(
    () =>
      StyleSheet.create({
        // Search bar
        searchBarRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 8,
          paddingTop: 6,
          paddingBottom: 2,
          gap: 4,
        },
        backButton: {
          paddingHorizontal: 8,
          paddingVertical: 6,
        },
        searchBar: {
          borderRadius: 12,
          elevation: 2,
        },
        segmentedButtons: {
          marginHorizontal: 10,
          marginTop: 8,
          marginBottom: 4,
        },
        // Loading
        loadingRow: {
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 8,
          paddingVertical: 6,
        },
        loadingText: {
          opacity: 0.7,
          fontSize: 13,
        },
        // Result header
        resultHeaderRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          paddingHorizontal: 14,
          paddingVertical: 6,
        },
        resultHeaderText: {
          fontSize: 12,
          fontWeight: '600',
          opacity: 0.8,
          flex: 1,
        },
        movieNoteText: {
          fontSize: 11,
          color: '#a06800',
          fontStyle: 'italic',
        },
        totalAnimeText: {
          textAlign: 'center',
          marginTop: 8,
          marginBottom: 4,
          fontWeight: 'bold',
          fontSize: 13,
          opacity: 0.7,
        },
        // Empty state
        center: {
          justifyContent: 'center',
          alignItems: 'center',
          flex: 1,
        },
        emptyStateContainer: {
          alignItems: 'center',
          paddingHorizontal: 36,
        },
        emptyStateTitle: {
          fontSize: 18,
          fontWeight: 'bold',
          marginBottom: 6,
          textAlign: 'center',
        },
        emptyStateSubtitle: {
          fontSize: 13,
          textAlign: 'center',
          opacity: 0.6,
          marginBottom: 20,
        },
        proTip: {
          fontSize: 12,
          fontStyle: 'italic',
          opacity: 0.75,
          marginBottom: 4,
        },
        loadButton: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingVertical: 11,
          paddingHorizontal: 22,
          borderRadius: 24,
          elevation: 2,
        },
        loadButtonText: {
          fontWeight: 'bold',
          fontSize: 14,
        },
        // Anime list default
        animeList: {
          justifyContent: 'center',
          paddingVertical: 10,
          flexDirection: 'row',
          backgroundColor: isDark ? '#1d1d1d' : '#f5f5f5',
          marginHorizontal: 16,
          borderRadius: 12,
          elevation: 2,
        },
        animeListIndex: {
          marginLeft: 4,
          fontWeight: 'bold',
          fontSize: 12,
          color: theme.colors.onPrimaryContainer,
        },
        animeListTitle: {
          textAlign: 'center',
          flex: 1,
          fontWeight: 'bold',
        },
        // Search result card
        searchCard: {
          flexDirection: 'row',
          backgroundColor: isDark ? '#1e1e1e' : '#fff',
          borderRadius: 14,
          elevation: 4,
          overflow: 'hidden',
          minHeight: 110,
          borderWidth: 0.5,
          borderColor: isDark ? '#2a2a2a' : '#e8e8e8',
        },
        searchThumbnailWrapper: {
          position: 'relative',
          width: 80,
        },
        searchThumbnail: {
          width: 80,
          height: '100%',
        },
        // Badge pojok kiri atas — sinkron sama Home
        searchBadge: {
          position: 'absolute',
          top: 5,
          left: 5,
          paddingHorizontal: 6,
          paddingVertical: 2,
          borderRadius: 4,
        },
        searchBadgeText: {
          color: '#fff',
          fontSize: 9,
          fontWeight: 'bold',
        },
        ratingBadge: {
          position: 'absolute',
          top: 5,
          right: 5,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: 'rgba(0,0,0,0.72)',
          paddingHorizontal: 5,
          paddingVertical: 2,
          borderRadius: 4,
        },
        ratingBadgeText: {
          color: '#fff',
          fontSize: 9,
          fontWeight: 'bold',
        },
        searchInfoInner: {
          flex: 1,
          padding: 10,
          justifyContent: 'space-between',
        },
        searchTitle: {
          color: '#fff',
          fontSize: 13,
          fontWeight: 'bold',
          lineHeight: 18,
        },
        synopsisText: {
          color: 'rgba(255,255,255,0.6)',
          fontSize: 11,
          marginTop: 4,
        },
        tagRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 4,
          marginTop: 6,
        },
        tag: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          paddingHorizontal: 7,
          paddingVertical: 3,
          borderRadius: 5,
        },
        tagText: {
          color: '#fff',
          fontSize: 10,
          fontWeight: '600',
        },
        // Search history overlay
        searchHistoryContainer: {
          position: 'absolute',
          top: 60,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 10,
          backgroundColor: isDark ? '#121212' : '#fafafa',
          padding: 10,
          elevation: 5,
        },
        searchHistoryScrollBox: {
          padding: 4,
        },
        searchHistoryHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          padding: 10,
          backgroundColor: isDark ? '#1a1a1a' : '#f0f0f0',
          borderRadius: 10,
          marginBottom: 6,
        },
        historyHeaderText: {
          fontWeight: 'bold',
          fontSize: 13,
        },
        historyDivider: {
          height: 1,
          backgroundColor: isDark ? '#2a2a2a' : '#e8e8e8',
          marginHorizontal: 8,
        },
        searchHistoryItemContainer: {
          backgroundColor: isDark ? '#1e1e1e' : '#f5f5f5',
          borderRadius: 10,
          marginVertical: 2,
        },
        historyItem: {
          padding: 10,
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: 44,
        },
        // Section header
        sectionHeaderContainer: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 8,
          paddingHorizontal: 4,
        },
        sectionHeaderText: {
          fontSize: 13,
          fontWeight: 'bold',
          marginHorizontal: 10,
          color: theme.colors.primary,
        },
        sectionHeaderLine: {
          flex: 1,
          height: 1,
          backgroundColor: theme.colors.outlineVariant,
        },
        // Close button
        closeSearchResult: {
          position: 'absolute',
          backgroundColor: '#dd0d0dd3',
          borderRadius: 20,
          padding: 10,
          bottom: 20,
          right: 12,
          zIndex: 1,
          elevation: 6,
        },
        snackbar: {
          zIndex: 2,
          position: 'absolute',
          bottom: 0,
          alignSelf: 'center',
        },
      }),
    [globalStyles.text.color, isDark, theme],
  );
}

export default memo(Search);
