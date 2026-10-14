import React, { useState, useEffect } from 'react';
import {
  Zap,
  Battery,
  BatteryCharging,
  AlertTriangle,
  Cpu,
  Wifi
} from 'lucide-react';
import { equipmentStore } from '../services/equipmentStore';
import type { BedsideEquipmentDevice } from '../types/icu';

interface EquipmentMonitoringCardProps {
  patientId: string;
  roomName: string;
}

export const EquipmentMonitoringCard: React.FC<EquipmentMonitoringCardProps> = ({
  patientId,
  roomName,
}) => {
  const [devices, setDevices] = useState<BedsideEquipmentDevice[]>([]);

  useEffect(() => {
    const list = equipmentStore.getDevicesByPatient(patientId);
    setDevices(list.length > 0 ? list : equipmentStore.getDevicesByRoom(roomName));

    const unsubscribe = equipmentStore.subscribe(() => {
      const fresh = equipmentStore.getDevicesByPatient(patientId);
      setDevices(fresh.length > 0 ? fresh : equipmentStore.getDevicesByRoom(roomName));
    });
    return unsubscribe;
  }, [patientId, roomName]);

  const handleClearFault = (deviceId: string, faultIndex: number) => {
    equipmentStore.clearEquipmentFault(deviceId, faultIndex);
  };

  return (
    <div className="clinical-card p-5 bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-xs space-y-4 font-mono text-xs">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700/60 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-lg border border-blue-200 dark:border-blue-900/50">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-slate-900 dark:text-slate-100 text-sm tracking-tight">
                Bedside Medical Equipment & Sensor Telemetry
              </h3>
              <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded">
                SIMULATED HARDWARE STATE
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Live power status, cable connection integrity, battery health, and isolated hardware fault alarms
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Equipment Health</span>
          <span
            className={`font-black text-xs ${
              devices.some((d) => d.overallStatus === 'CRITICAL')
                ? 'text-red-600 dark:text-red-400'
                : devices.some((d) => d.overallStatus === 'WARNING')
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {devices.some((d) => d.overallStatus === 'CRITICAL')
              ? 'CRITICAL FAULT'
              : devices.some((d) => d.overallStatus === 'WARNING')
              ? 'WARNING / SENSOR CHECK'
              : 'ALL NORMAL (ONLINE)'}
          </span>
        </div>
      </div>

      {/* Equipment Alert Separation Notice */}
      <div className="p-2.5 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700/60 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
        <span>
          Note: Medical device warnings represent hardware/sensor states and are maintained strictly separate from patient physiological deterioration risk.
        </span>
      </div>

      {/* Devices list */}
      {devices.length === 0 ? (
        <div className="p-6 text-center text-slate-400">
          No bedside telemetry devices registered for this room.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {devices.map((dev) => {
            const isWarn = dev.overallStatus === 'WARNING';
            const isCrit = dev.overallStatus === 'CRITICAL';
            return (
              <div
                key={dev.deviceId}
                className={`p-3.5 rounded-xl border transition-all space-y-3 ${
                  isCrit
                    ? 'bg-red-50/50 dark:bg-red-950/20 border-red-300 dark:border-red-900'
                    : isWarn
                    ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-300 dark:border-amber-900/60'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700/80 shadow-xs'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-900 dark:text-slate-100">{dev.deviceName}</span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      Model: {dev.modelNumber} • {dev.deviceType}
                    </span>
                  </div>

                  <span
                    className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${
                      isCrit
                        ? 'bg-red-600 text-white'
                        : isWarn
                        ? 'bg-amber-500 text-white'
                        : 'bg-emerald-600 text-white'
                    }`}
                  >
                    {dev.overallStatus}
                  </span>
                </div>

                {/* Telemetry metrics grid */}
                <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
                  {/* Cable Connection */}
                  <div className="p-2 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Sensor Link</span>
                    <span
                      className={`font-bold flex items-center gap-1 mt-0.5 ${
                        dev.connectionState === 'Connected'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      <Wifi className="w-3 h-3" />
                      {dev.connectionState}
                    </span>
                    <span className="text-[9px] text-slate-400">{dev.cableIntegrity}</span>
                  </div>

                  {/* Power Source & Battery */}
                  <div className="p-2 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Power Source</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1 mt-0.5">
                      {dev.isCharging ? <BatteryCharging className="w-3 h-3 text-emerald-500" /> : <Battery className="w-3 h-3" />}
                      {dev.batteryPercentage}%
                    </span>
                    <span className="text-[9px] text-slate-400">{dev.powerSource}</span>
                  </div>

                  {/* Voltage Stability */}
                  <div className="p-2 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Voltage</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1 mt-0.5">
                      <Zap className="w-3 h-3 text-amber-500" />
                      {dev.voltageReading}V
                    </span>
                    <span className="text-[9px] text-slate-400">{dev.voltageStability}</span>
                  </div>
                </div>

                {/* Active Faults */}
                {dev.activeFaults.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {dev.activeFaults.map((fault, fIdx) => (
                      <div
                        key={fIdx}
                        className="p-2 bg-red-100/80 dark:bg-red-950/60 border border-red-300 dark:border-red-900 rounded-lg flex items-center justify-between text-[11px] text-red-900 dark:text-red-200"
                      >
                        <span className="flex items-center gap-1 font-semibold">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                          {fault}
                        </span>
                        <button
                          onClick={() => handleClearFault(dev.deviceId, fIdx)}
                          className="text-[10px] underline font-bold ml-2 text-red-700 dark:text-red-300 hover:text-red-900"
                        >
                          Acknowledge
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
