import Icon from '@react-native-vector-icons/fontawesome';
import MaterialIcon from '@react-native-vector-icons/material-icons';
import { FlashList } from '@shopify/flash-list';
import * as DocumentPicker from 'expo-document-picker';
import { useVideoPlayer, VideoView } from 'expo-video';
import moment from 'moment';
import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  ToastAndroid,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { TouchableNativeFeedback } from 'react-native-gesture-handler';

import useGlobalStyles from '@assets/style';
import ImageLoading from '@component/misc/ImageLoading';

interface SearchResult {
  frameCount: number;
  error: string;
  result: Result[];
}

interface Result {
  anilist: {
    id: number;
    idMal: number;
    title: {
      native: string;
      romaji: string | null;
      english: string | null;
    };
    synonyms: string[];
    isAdult: boolean;
  };
  filename: string;
  episode: null | number;
  from: number;
  to: number;
  similarity: number;
  video: string;
  image: string;
}

const exampleResult: Result = {
  anilist: {
    id: 0,
    idMal: 0,
    title: { native: '', romaji: 'Judul Anime', english: '' },
    synonyms: [],
    isAdult: false,
  },
  filename: 'Pilih terlebih dahulu.mp4',
  episode: null,
  from: 0,
  to: 0,
  similarity: 0,
  video: '',
  image: '',
};
const exampleResultArray: Result[] = new Array(3).fill(exampleResult);

function SearchAnimeByImage() {
  const globalStyles = useGlobalStyles();
  const [videoModal, setVideoModal] = useState<{ open: boolean; link: string }>({
    open: false,
    link: '',
  });
  const [searchResult, setSearchResult] = useState<SearchResult>({
    frameCount: 0,
    error: '',
    result: exampleResultArray,
  });
  const player = useVideoPlayer(videoModal.link, p => {
    p.muted = true;
    p.loop = true;
    p.play();
  });
  const [choosenImage, setChoosenImage] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const styles = useStyles();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const closeModal = useCallback(() => setVideoModal({ open: false, link: '' }), []);

  const similarityColor = (similarity: number) => {
    if (similarity >= 0.9) return '#4CAF50';
    if (similarity >= 0.7) return '#FF9800';
    return '#F44336';
  };

  return (
    <View style={styles.container}>
      <Modal visible={videoModal.open} transparent animationType="fade" onRequestClose={closeModal}>
        <View style={styles.videoModalBackdrop}>
          <View style={styles.videoModalContainer}>
            <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
              <MaterialIcon name="close" color="white" size={28} />
            </TouchableOpacity>
            <VideoView
              player={player}
              nativeControls={false}
              contentFit="contain"
              style={styles.videoPlayer}
            />
          </View>
        </View>
      </Modal>

      <FlashList
        data={searchResult?.result?.filter(val => val.anilist.isAdult === false)}
        estimatedItemSize={160}
        ListHeaderComponent={() => (
          <>
            {/* Image Picker Card */}
            <View style={styles.pickerCard}>
              <TouchableNativeFeedback
                background={TouchableNativeFeedback.Ripple(
                  isDark ? '#3a3a3a' : '#e0e0e0',
                  false,
                )}
                onPress={() => {
                  DocumentPicker.getDocumentAsync({
                    type: ['image/*'],
                    copyToCacheDirectory: false,
                  }).then(result => {
                    setChoosenImage(result.assets?.[0].uri);
                    const formData = new FormData();
                    formData.append('image', {
                      uri: result.assets?.[0].uri,
                      name: 'image.png',
                      type: 'image/png',
                    });
                    setIsLoading(true);
                    fetch('https://api.trace.moe/search?anilistInfo', {
                      method: 'POST',
                      body: formData,
                    })
                      .then(e => e.json() as Promise<SearchResult>)
                      .then(setSearchResult)
                      .finally(() => setIsLoading(false))
                      .catch(() => {
                        setSearchResult({ frameCount: 0, error: '', result: exampleResultArray });
                        ToastAndroid.show('Terjadi kesalahan!', ToastAndroid.SHORT);
                      });
                  });
                }}>
                <View style={styles.pickerInner}>
                  {choosenImage ? (
                    <ImageLoading
                      source={{ uri: choosenImage }}
                      style={styles.selectedImage}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={styles.pickerPlaceholder}>
                      <View style={styles.pickerIconWrapper}>
                        <MaterialIcon
                          name="add-photo-alternate"
                          size={36}
                          color={isDark ? '#BB86FC' : '#6200EE'}
                        />
                      </View>
                      <Text style={styles.pickerTitle}>Pilih Gambar</Text>
                      <Text style={styles.pickerSubtitle}>JPG, PNG • Ketuk untuk memilih</Text>
                    </View>
                  )}
                  {choosenImage && (
                    <View style={styles.changeImageOverlay}>
                      <MaterialIcon name="edit" size={16} color="white" />
                      <Text style={styles.changeImageText}>Ganti gambar</Text>
                    </View>
                  )}
                </View>
              </TouchableNativeFeedback>
            </View>

            {/* Tips Card */}
            <View style={styles.tipsCard}>
              <View style={styles.tipRow}>
                <View style={[styles.tipIconBadge, { backgroundColor: isDark ? '#3D2C00' : '#FFF3E0' }]}>
                  <MaterialIcon name="warning" size={14} color={isDark ? '#FFA726' : '#FB8C00'} />
                </View>
                <Text style={styles.tipText}>Filter hasil dewasa aktif</Text>
              </View>
              <View style={[styles.tipRow, { marginBottom: 0 }]}>
                <View style={[styles.tipIconBadge, { backgroundColor: isDark ? '#003547' : '#E1F5FE' }]}>
                  <MaterialIcon name="lightbulb" size={14} color={isDark ? '#4FC3F7' : '#039BE5'} />
                </View>
                <Text style={styles.tipText}>
                  Untuk hasil maksimal pastikan gambar tidak terpotong dan tidak ada border tambahan
                </Text>
              </View>
            </View>

            {/* Results label */}
            <Text style={styles.resultsLabel}>Hasil Pencarian</Text>
          </>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.resultCard}
            onPress={() => item.video && setVideoModal({ open: true, link: item.video })}
            disabled={!item.video || isLoading}
            activeOpacity={0.75}>
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={isDark ? '#BB86FC' : '#6200EE'} />
              </View>
            ) : (
              <>
                <View style={styles.resultHeader}>
                  {item.image ? (
                    <ImageLoading style={styles.resultImage} source={{ uri: item.image }} />
                  ) : (
                    <View style={styles.resultImagePlaceholder}>
                      <Icon name="image" size={28} color={isDark ? '#555' : '#ccc'} />
                    </View>
                  )}
                  <View style={styles.resultTextContainer}>
                    <Text style={styles.animeTitle} numberOfLines={2}>
                      {item.anilist.title.romaji || 'Unknown Title'}
                    </Text>
                    <Text style={styles.filename} numberOfLines={1}>{item.filename}</Text>
                    {item.video ? (
                      <View style={styles.playBadge}>
                        <MaterialIcon name="play-circle-filled" size={12} color={isDark ? '#BB86FC' : '#6200EE'} />
                        <Text style={[styles.playBadgeText, { color: isDark ? '#BB86FC' : '#6200EE' }]}>
                          Ketuk untuk preview
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.resultDetails}>
                  <View style={styles.detailRow}>
                    <MaterialIcon name="info-outline" size={14} color={isDark ? '#aaa' : '#888'} />
                    <Text style={styles.detailText}>Episode {item.episode ?? '-'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <MaterialIcon name="access-time" size={14} color={isDark ? '#aaa' : '#888'} />
                    <Text style={styles.detailText}>
                      {moment.unix(item.from).utc(false).format('HH:mm:ss')} –{' '}
                      {moment.unix(item.to).utc(false).format('HH:mm:ss')}
                    </Text>
                  </View>
                </View>

                {/* Similarity bar */}
                <View style={styles.similarityContainer}>
                  <View style={styles.similarityLabelRow}>
                    <Text style={styles.similarityLabel}>Kemiripan</Text>
                    <Text style={[styles.similarityValue, { color: similarityColor(item.similarity) }]}>
                      {((item.similarity || 0) * 100).toFixed(1)}%
                    </Text>
                  </View>
                  <View style={styles.similarityBarBg}>
                    <View
                      style={[
                        styles.similarityBarFill,
                        {
                          width: `${(item.similarity || 0) * 100}%` as any,
                          backgroundColor: similarityColor(item.similarity),
                        },
                      ]}
                    />
                  </View>
                </View>
              </>
            )}
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

function useStyles() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: isDark ? '#111' : '#f0f0f0',
        },
        // Picker
        pickerCard: {
          marginHorizontal: 16,
          marginTop: 16,
          marginBottom: 12,
          borderRadius: 16,
          overflow: 'hidden',
          backgroundColor: isDark ? '#1E1E1E' : '#fff',
          elevation: 2,
        },
        pickerInner: {
          minHeight: 160,
          justifyContent: 'center',
          alignItems: 'center',
        },
        pickerPlaceholder: {
          alignItems: 'center',
          paddingVertical: 28,
          paddingHorizontal: 16,
        },
        pickerIconWrapper: {
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: isDark ? '#2D1F4E' : '#EDE7F6',
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: 12,
        },
        pickerTitle: {
          fontSize: 17,
          fontWeight: 'bold',
          color: isDark ? '#E0E0E0' : '#222',
          marginBottom: 4,
        },
        pickerSubtitle: {
          fontSize: 12,
          color: isDark ? '#888' : '#999',
        },
        selectedImage: {
          width: '100%',
          height: 200,
        },
        changeImageOverlay: {
          position: 'absolute',
          bottom: 10,
          right: 10,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          backgroundColor: 'rgba(0,0,0,0.6)',
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: 20,
        },
        changeImageText: {
          color: 'white',
          fontSize: 12,
          fontWeight: '500',
        },
        // Tips
        tipsCard: {
          marginHorizontal: 16,
          marginBottom: 16,
          backgroundColor: isDark ? '#1E1E1E' : '#fff',
          borderRadius: 12,
          padding: 14,
          elevation: 1,
        },
        tipRow: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          marginBottom: 10,
          gap: 10,
        },
        tipIconBadge: {
          width: 26,
          height: 26,
          borderRadius: 8,
          justifyContent: 'center',
          alignItems: 'center',
          flexShrink: 0,
        },
        tipText: {
          fontSize: 12,
          color: isDark ? '#AAA' : '#666',
          flex: 1,
          lineHeight: 18,
          paddingTop: 4,
        },
        // Results
        resultsLabel: {
          fontSize: 11,
          fontWeight: 'bold',
          letterSpacing: 1,
          color: isDark ? '#888' : '#999',
          textTransform: 'uppercase',
          paddingHorizontal: 16,
          marginBottom: 8,
        },
        listContent: {
          paddingBottom: 24,
        },
        resultCard: {
          backgroundColor: isDark ? '#1E1E1E' : '#fff',
          borderRadius: 14,
          padding: 14,
          marginHorizontal: 16,
          marginBottom: 12,
          elevation: 2,
        },
        resultHeader: {
          flexDirection: 'row',
          marginBottom: 10,
          gap: 12,
        },
        resultImage: {
          width: 80,
          height: 64,
          borderRadius: 8,
        },
        resultImagePlaceholder: {
          width: 80,
          height: 64,
          borderRadius: 8,
          backgroundColor: isDark ? '#2A2A2A' : '#EEE',
          justifyContent: 'center',
          alignItems: 'center',
        },
        resultTextContainer: {
          flex: 1,
          justifyContent: 'center',
          gap: 3,
        },
        animeTitle: {
          fontSize: 15,
          fontWeight: 'bold',
          color: isDark ? '#E0E0E0' : '#222',
          lineHeight: 20,
        },
        filename: {
          fontSize: 11,
          color: isDark ? '#777' : '#AAA',
        },
        playBadge: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          marginTop: 2,
        },
        playBadgeText: {
          fontSize: 11,
          fontWeight: '500',
        },
        divider: {
          height: StyleSheet.hairlineWidth,
          backgroundColor: isDark ? '#2A2A2A' : '#EEE',
          marginBottom: 10,
        },
        resultDetails: {
          flexDirection: 'row',
          gap: 16,
          marginBottom: 10,
        },
        detailRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
        },
        detailText: {
          fontSize: 12,
          color: isDark ? '#AAA' : '#777',
        },
        // Similarity bar
        similarityContainer: {
          gap: 5,
        },
        similarityLabelRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        },
        similarityLabel: {
          fontSize: 11,
          color: isDark ? '#888' : '#999',
          fontWeight: '500',
        },
        similarityValue: {
          fontSize: 13,
          fontWeight: 'bold',
        },
        similarityBarBg: {
          height: 5,
          backgroundColor: isDark ? '#2A2A2A' : '#EEE',
          borderRadius: 3,
          overflow: 'hidden',
        },
        similarityBarFill: {
          height: '100%',
          borderRadius: 3,
        },
        loadingContainer: {
          height: 120,
          justifyContent: 'center',
          alignItems: 'center',
        },
        // Modal
        videoModalBackdrop: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.92)',
          justifyContent: 'center',
        },
        videoModalContainer: {
          marginHorizontal: 20,
          borderRadius: 14,
          overflow: 'hidden',
        },
        videoPlayer: {
          width: '100%',
          aspectRatio: 16 / 9,
        },
        closeButton: {
          position: 'absolute',
          top: 12,
          right: 12,
          zIndex: 10,
          backgroundColor: 'rgba(0,0,0,0.55)',
          borderRadius: 20,
          width: 40,
          height: 40,
          justifyContent: 'center',
          alignItems: 'center',
        },
      }),
    [isDark],
  );
}

export default memo(SearchAnimeByImage);
