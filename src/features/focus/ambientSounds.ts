/**
 * Âm thanh thiên nhiên – tải từ Wikimedia Commons (giấy phép tự do), đặt trong public/sounds/.
 * Ghi công tác giả đầy đủ trong README (mục "Nguồn ảnh & âm thanh").
 */
export interface AmbientSound {
  id: string;
  label: string;
  emoji: string;
  file: string;
  credit: string;
}

export const AMBIENT_SOUNDS: AmbientSound[] = [
  { id: 'rain-window', label: 'Mưa bên cửa sổ', emoji: '🌧️', file: 'rain-window.mp3', credit: '“Rain against the window” – cori, Public domain' },
  { id: 'rain-leaves', label: 'Mưa trên lá', emoji: '🍃', file: 'rain-leaves.mp3', credit: '“Rain on leaves” – Gravity Sound, CC BY 4.0' },
  { id: 'water', label: 'Nước chảy', emoji: '💧', file: 'water.mp3', credit: '“Water flowing pouring trickling” – stephan, Public domain' },
  { id: 'wind', label: 'Gió trong rừng', emoji: '🌬️', file: 'wind.mp3', credit: '“Wind in forest” – Gravity Sound, CC BY 4.0' },
  { id: 'birds', label: 'Chim hót', emoji: '🐦', file: 'birds.mp3', credit: '“Birds forest” – Barracuda1983, Public domain' },
  { id: 'pond', label: 'Đêm bên ao', emoji: '🐸', file: 'pond.mp3', credit: '“Nature sounds ambience in a Dordogne pond” – Glaneur de sons, CC BY 3.0' },
];

export const soundSrc = (s: AmbientSound) => `${import.meta.env.BASE_URL}sounds/${s.file}`;
