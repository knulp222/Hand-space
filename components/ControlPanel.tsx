
import React from 'react';
import { GameSettings } from '../types';

interface ControlPanelProps {
  settings: GameSettings;
  onUpdate: (newSettings: GameSettings) => void;
  onClose: () => void;
  onResetObjects: () => void;
  isCameraOn: boolean;
  onToggleCamera: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({ 
  settings, 
  onUpdate, 
  onClose, 
  onResetObjects,
  isCameraOn,
  onToggleCamera
}) => {
  const handleChange = (key: keyof GameSettings, value: number | boolean | string) => {
    onUpdate({ ...settings, [key]: value });
  };

  return (
    <div className="absolute top-4 right-4 w-80 bg-neutral-900/90 backdrop-blur-md p-6 rounded-xl border border-neutral-700 shadow-2xl text-sm z-50 animate-in fade-in slide-in-from-top-4 max-h-[90vh] overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-emerald-400 tracking-wide">Paramètres Système</h2>
        <button onClick={onClose} className="text-neutral-400 hover:text-white transition-colors">✕</button>
      </div>

      <div className="space-y-5">
        
        <div className="pb-2 border-b border-neutral-800">
            <button 
                onClick={onToggleCamera}
                className={`w-full py-2 rounded-md transition-colors text-sm font-bold flex items-center justify-center gap-2 ${isCameraOn ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'}`}
            >
                {isCameraOn ? (
                    <>
                        <span className="relative flex h-3 w-3 mr-1">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                        </span>
                        STOPPER CAMÉRA
                    </>
                ) : 'ACTIVER CAMÉRA'}
            </button>
        </div>

        {/* Physics Group */}
        <div className="space-y-3">
          <h3 className="text-xs uppercase tracking-wider text-neutral-500 font-semibold">Physique Spatiale</h3>
          
          <div className="space-y-1">
            <div className="flex justify-between text-neutral-300">
              <label>Gravité</label>
              <span>{settings.gravity.toFixed(2)}</span>
            </div>
            <input 
              type="range" min="-0.5" max="1" step="0.01" 
              value={settings.gravity} 
              onChange={(e) => handleChange('gravity', parseFloat(e.target.value))}
              className="w-full accent-emerald-500 h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-neutral-300">
              <label>Friction (Inertie)</label>
              <span>{settings.friction.toFixed(3)}</span>
            </div>
            <input 
              type="range" min="0.900" max="1.000" step="0.001" 
              value={settings.friction} 
              onChange={(e) => handleChange('friction', parseFloat(e.target.value))}
              className="w-full accent-emerald-500 h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>

        <hr className="border-neutral-800" />

        {/* Blob & Collisions Group */}
        <div className="space-y-3">
          <h3 className="text-xs uppercase tracking-wider text-neutral-500 font-semibold">Blobs & Intéractions</h3>
          
           <div className="flex items-center justify-between">
            <label className="text-neutral-300">Collisions Actives</label>
            <input 
              type="checkbox"
              checked={settings.enableCollisions}
              onChange={(e) => handleChange('enableCollisions', e.target.checked)}
              className="w-5 h-5 accent-emerald-500 rounded"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-neutral-300">
              <label>Probabilité Fusion</label>
              <span>{(settings.fusionChance * 100).toFixed(0)}%</span>
            </div>
            <input 
              type="range" min="0" max="1" step="0.05" 
              value={settings.fusionChance} 
              onChange={(e) => handleChange('fusionChance', parseFloat(e.target.value))}
              className="w-full accent-emerald-500 h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-neutral-300">
              <label>Effet Gélatine (Blob)</label>
              <span>{settings.blobFactor.toFixed(1)}</span>
            </div>
            <input 
              type="range" min="0" max="20" step="1" 
              value={settings.blobFactor} 
              onChange={(e) => handleChange('blobFactor', parseFloat(e.target.value))}
              className="w-full accent-emerald-500 h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>

        <hr className="border-neutral-800" />

        {/* Interaction Group */}
        <div className="space-y-3">
          <h3 className="text-xs uppercase tracking-wider text-neutral-500 font-semibold">Mains</h3>
          
          <div className="space-y-1">
             <div className="flex justify-between text-neutral-300">
              <label>Sensibilité Pincement</label>
              <span>{settings.pinchThreshold}px</span>
            </div>
            <input 
              type="range" min="20" max="100" step="1" 
              value={settings.pinchThreshold} 
              onChange={(e) => handleChange('pinchThreshold', parseFloat(e.target.value))}
              className="w-full accent-emerald-500 h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="text-neutral-300">Afficher Squelette</label>
            <input 
              type="checkbox"
              checked={settings.showSkeleton}
              onChange={(e) => handleChange('showSkeleton', e.target.checked)}
              className="w-5 h-5 accent-emerald-500 rounded"
            />
          </div>
        </div>

        <hr className="border-neutral-800" />

        <div className="pt-2">
          <button 
            onClick={onResetObjects}
            className="w-full py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-md transition-colors text-sm font-medium border border-neutral-600"
          >
            Réinitialiser les Blobs
          </button>
        </div>
      </div>
    </div>
  );
};
