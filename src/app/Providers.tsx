'use client';

import * as React from 'react';
import {
  RainbowKitProvider,
  getDefaultConfig,
  darkTheme,
} from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import '@rainbow-me/rainbowkit/styles.css';

// GenLayer Bradbury Testnet
export const genlayerBradbury = {
  id: 4221,
  name: 'GenLayer Bradbury',
  nativeCurrency: { name: 'GEN', symbol: 'GEN', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://zksync-os-testnet-genlayer.zksync.dev'] },
  },
  blockExplorers: {
    default: { name: 'Explorer', url: 'https://explorer-bradbury.genlayer.com' },
  },
} as const;

// Configuración de viem/wagmi
const config = getDefaultConfig({
  appName: 'GenLayer Snake',
  projectId: 'YOUR_PROJECT_ID',
  chains: [genlayerBradbury],
  ssr: true,
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: '#10b981', // Verde esmeralda (Snake)
            accentColorForeground: 'white',
            borderRadius: 'medium',
            fontStack: 'system',
            overlayBlur: 'small',
          })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
