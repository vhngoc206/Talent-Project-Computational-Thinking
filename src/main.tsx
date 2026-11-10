import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/nunito';
import '@fontsource-variable/lora';
import './index.css';
import App from './App';
import { loadAiConfig } from './services/aiService';

// Hỏi server tính năng AI nào đã bật trước khi vẽ giao diện (tối đa vài giây, lỗi => Demo Mode)
void loadAiConfig().finally(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
);
