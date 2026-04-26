import Icon from '@react-native-vector-icons/material-design-icons';
import { DrawerScreenProps } from '@react-navigation/drawer';
import { StackActions } from '@react-navigation/native';
import { FlashList, FlashListRef, ListRenderItem } from '@shopify/flash-list';
import moment from 'moment';
import { memo, useCallback, useMemo, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import URL from 'url';

import { SayaDrawerNavigator } from '@/types/navigation';
import watchLaterJSON from '@/types/watchLaterJSON';
import useGlobalStyles from '@assets/style';
import ImageLoading from '@component/misc/ImageLoading';
import { useModifiedKeyValueIfFocused } from '@utils/DatabaseManager';
import DialogManager from '@utils/dialogManager';
import controlWatchLater from '@utils/watchLaterControl';

type Props = DrawerScreenProps<SayaDrawerNavigator, 'WatchLater'>;

function WatchLater(props: Props) {
  const styles = useStyles();
  const globalStyles = useGlobalStyles();
  const theme = useTheme();
  const isDark = theme.dark;

  const watchLaterLists = useModifiedKeyValueIfFocused<watchLaterJSON[]>(
    'watchLater',
    result => JSON.parse(result) as watchLaterJSON[],
  );

  const flashlistRef = useRef<FlashListRef<watchLaterJSON>>(null);

  const renderItem = useCallback<ListRenderItem<watchLaterJSON>>(
    ({ item, index }) => {
      // Badge config
      const badgeConfig =
        item.rating === 'Film'
          ? { label: 'Film', color: '#E64A19', icon: 'movie-open' }
          : item.isComics
            ? { label: 'Komik', color: '#0288D1', icon: 'book-open-variant' }
            : item.rating
              ? { label: item.rating, color: '#F59E0B', icon: 'star' }
              : null;

      return (
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.75}
          onPress={() => {
            props.navigation.dispatch(
              StackActions.push('FromUrl', {
                title: item.title,
                link: item.link,
                type: URL.parse(item.link).hostname!?.includes('idlix')
                  ? 'film'
                  : item.isMovie
                    ? 'movie'
                    : item.isComics
                      ? 'comics'
                      : 'anime',
              }),
            );
          }}>
          {/* Thumbnail */}
          <View style={styles.thumbnailWrapper}>
            <ImageLoading source={{ uri: item.thumbnailUrl }} style={styles.thumbnail} resizeMode="cover" />
            {badgeConfig && (
              <View style={[styles.thumbnailBadge, { backgroundColor: badgeConfig.color }]}>
                <Icon name={badgeConfig.icon} size={10} color="#fff" />
                <Text style={styles.thumbnailBadgeText}>{badgeConfig.label}</Text>
              </View>
            )}
          </View>

          {/* Info */}
          <View style={styles.infoContainer}>
            {/* Tanggal + Hapus */}
            <View style={styles.topRow}>
              <Text style={styles.dateText} numberOfLines={1}>
                {moment(item.date).format('dddd DD-MM-YYYY [Pukul] HH:mm')}
              </Text>
              <TouchableOpacity
                hitSlop={6}
                style={styles.deleteButton}
                onPress={() => {
                  DialogManager.alert(
                    'Hapus Tonton Nanti',
                    `Apakah kamu yakin ingin menghapus "${item.title}" dari daftar tonton nanti?`,
                    [
                      { text: 'Batal', onPress: () => {} },
                      { text: 'Hapus', onPress: () => controlWatchLater('delete', index) },
                    ],
                  );
                }}>
                <Icon name="delete-forever" size={20} style={styles.deleteIcon} />
              </TouchableOpacity>
            </View>

            {/* Judul */}
            <Text style={[globalStyles.text, styles.title]} numberOfLines={2}>
              {item.title}
            </Text>

            {/* Genre */}
            <View style={styles.genreContainer}>
              {item.genre
                .toString()
                .split(',')
                .slice(0, 3)
                .map((g, i) => (
                  <View key={i} style={styles.genrePill}>
                    <Text style={styles.genrePillText} numberOfLines={1}>
                      {g.trim()}
                    </Text>
                  </View>
                ))}
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [globalStyles.text, props.navigation, styles],
  );

  return (
    <View style={{ flex: 1 }}>
      {watchLaterLists.length === 0 ? (
        <View style={styles.emptyList}>
          <Icon name="bookmark-outline" size={48} color={globalStyles.text.color + '44'} />
          <Text style={[globalStyles.text, { marginTop: 12, opacity: 0.5 }]}>
            Belum ada daftar tonton nanti
          </Text>
        </View>
      ) : (
        <FlashList
          drawDistance={250}
          ref={flashlistRef}
          data={watchLaterLists}
          extraData={styles}
          renderItem={renderItem}
          keyExtractor={extractKey}
          estimatedItemSize={120}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 16 }}
          ListHeaderComponent={() => (
            <View style={{ paddingVertical: 10 }}>
              <Text style={[globalStyles.text, styles.countText]}>
                Daftar tonton nanti:{' '}
                <Text style={{ fontWeight: 'bold' }}>{watchLaterLists.length}</Text>
              </Text>
              <Text style={styles.sinceText}>
                Sejak {moment(watchLaterLists.at(-1)!.date).format('DD MMMM YYYY')}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const extractKey = (item: watchLaterJSON) => item.date.toString();

function useStyles() {
  const theme = useTheme();
  const isDark = theme.dark;

  return useMemo(
    () =>
      StyleSheet.create({
        countText: {
          fontSize: 13,
          opacity: 0.7,
        },
        sinceText: {
          fontSize: 12,
          color: isDark ? '#888' : '#999',
          marginTop: 2,
        },
        // Card
        card: {
          flexDirection: 'row',
          marginVertical: 5,
          backgroundColor: theme.colors.surface,
          borderRadius: 14,
          elevation: 3,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          overflow: 'hidden',
          borderWidth: 0.5,
          borderColor: isDark ? '#2a2a2a' : '#e8e8e8',
        },
        thumbnailWrapper: {
          position: 'relative',
        },
        thumbnail: {
          width: 85,
          height: 120,
        },
        thumbnailBadge: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          paddingVertical: 3,
        },
        thumbnailBadgeText: {
          color: '#fff',
          fontSize: 10,
          fontWeight: 'bold',
        },
        infoContainer: {
          flex: 1,
          paddingHorizontal: 10,
          paddingVertical: 8,
          justifyContent: 'space-between',
        },
        topRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        },
        dateText: {
          fontSize: 11,
          color: isDark ? '#888' : '#999',
          flex: 1,
        },
        deleteButton: {
          backgroundColor: theme.colors.errorContainer,
          borderRadius: 8,
          padding: 4,
        },
        deleteIcon: {
          color: theme.colors.onErrorContainer,
        },
        title: {
          fontSize: 13,
          fontWeight: '600',
          lineHeight: 18,
          flex: 1,
        },
        genreContainer: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 4,
        },
        genrePill: {
          backgroundColor: isDark ? '#1e2a3a' : '#e8f0fe',
          borderRadius: 20,
          paddingHorizontal: 8,
          paddingVertical: 3,
        },
        genrePillText: {
          fontSize: 10,
          fontWeight: '600',
          color: isDark ? '#90caf9' : '#1565c0',
        },
        emptyList: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
        },
      }),
    [theme, isDark],
  );
}

export default memo(WatchLater);
