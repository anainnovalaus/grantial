import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { installApiFetchInterceptor } from '@/lib/api'

installApiFetchInterceptor();

createRoot(document.getElementById("root")!).render(<App />);
