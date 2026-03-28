"use client";

import dynamic from "next/dynamic";

// Importa el juego de forma dinámica, deshabilitando el renderizado en servidor (SSR)
// para evitar el error "ReferenceError: window is not defined" y otros problemas de WebGL.
const DynamicSnakeGame = dynamic(() => import("./SnakeGame"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-black/50 gap-4">
      <div className="w-8 h-8 rounded-full border-b-2 border-emerald-500 animate-spin"></div>
      <p className="text-emerald-400 font-mono text-sm animate-pulse">
        Inicializando Motor Gráfico 3D...
      </p>
    </div>
  ),
});

export default function GameWrapper() {
  return <DynamicSnakeGame />;
}
