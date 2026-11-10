/** Thông báo "Tìm thấy dữ liệu cũ trên trình duyệt này" + nút chuyển vào tài khoản. */
import { useMemo, useState } from 'react';
import { HardDriveDownload, X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import { useAppState } from '../../state/AppStateContext';
import { useAuth } from './AuthContext';
import { countNewItems, legacyHandled, markLegacyHandled, mergeLegacy, readLegacyData } from './legacyData';

export function LegacyImportBanner() {
  const auth = useAuth();
  const { data, actions } = useAppState();
  const toast = useToast();
  const uid = auth?.user?.uid;
  const [hidden, setHidden] = useState(() => !uid || legacyHandled(uid));
  const legacy = useMemo(() => (hidden ? null : readLegacyData()), [hidden]);
  const counts = legacy ? countNewItems(data, legacy) : null;

  if (!uid || hidden || !legacy || !counts || counts.subjects + counts.tasks + counts.events === 0) return null;

  function importNow() {
    actions.replaceData(mergeLegacy(data, legacy!));
    markLegacyHandled(uid!);
    setHidden(true);
    toast('Đã chuyển dữ liệu cũ vào tài khoản của bạn.');
  }

  function dismiss() {
    markLegacyHandled(uid!);
    setHidden(true);
  }

  const parts = [
    counts.subjects && `${counts.subjects} môn học`,
    counts.tasks && `${counts.tasks} nhiệm vụ`,
    counts.events && `${counts.events} sự kiện`,
  ].filter(Boolean);

  return (
    <section className="anim-fade-up mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-sky p-4" aria-label="Dữ liệu cũ">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-sky-deep">
        <HardDriveDownload className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-extrabold text-ink">Tìm thấy dữ liệu bạn nhập trước đây trên trình duyệt này</p>
        <p className="text-xs text-ink-soft">
          {parts.join(', ')} chưa có trong tài khoản. Chuyển vào để dùng được trên mọi thiết bị – dữ liệu hiện có vẫn được giữ nguyên.
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        <Button size="sm" variant="primary" onClick={importNow}>
          Chuyển vào tài khoản
        </Button>
        <button type="button" onClick={dismiss} className="rounded-md p-1.5 text-ink-mute hover:bg-black/5" aria-label="Bỏ qua" title="Bỏ qua">
          <X className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}
