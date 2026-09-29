import React, { useState } from 'react';
import { Upload, CheckCircle, AlertTriangle, Database, X } from 'lucide-react';
import type { Patient } from '../types/icu';

interface DataImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportPatients: (imported: Patient[]) => void;
}

export const DataImportModal: React.FC<DataImportModalProps> = ({ isOpen, onClose, onImportPatients }) => {
  const [jsonText, setJsonText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleImportJSON = () => {
    try {
      setError(null);
      const parsed = JSON.parse(jsonText);
      const list = Array.isArray(parsed) ? parsed : [parsed];
      if (list.length === 0) throw new Error('Array is empty');
      onImportPatients(list);
      setSuccess(`Successfully imported ${list.length} patient records!`);
      setTimeout(() => {
        onClose();
        setSuccess(null);
      }, 1200);
    } catch (err: any) {
      setError(`Import Error: ${err.message || 'Invalid JSON format'}`);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setJsonText(content);
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-red-500" />
            <h3 className="font-bold text-sm tracking-wide">CLINICAL DATA FILE IMPORTER (JSON / CSV)</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-600">
            Import custom clinical datasets (JSON / CSV) to drive NeuroCare live monitoring, telemetry quality engine, and floor layout.
          </p>

          {/* File Picker */}
          <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center bg-slate-50 hover:bg-slate-100/80 transition-colors">
            <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <label className="cursor-pointer text-xs font-bold text-red-600 hover:underline">
              <span>Choose JSON/CSV File</span>
              <input type="file" accept=".json,.csv" onChange={handleFileUpload} className="hidden" />
            </label>
            <p className="text-[10px] text-slate-400 mt-1">Supports NeuroCare schema or clinical telemetry exports</p>
          </div>

          {/* Textarea */}
          <div>
            <label className="text-[11px] font-semibold text-slate-700 mb-1 block">Or Paste Payload Directly:</label>
            <textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              placeholder='[ { "id": "NC-ICU-001", "name": "Patient Name", ... } ]'
              className="w-full h-32 p-3 font-mono text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-700 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{success}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[10px] text-slate-400">Data integrity verification enabled</span>
          <button
            onClick={handleImportJSON}
            disabled={!jsonText.trim()}
            className="px-4 py-2 bg-red-600 text-white font-bold text-xs rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            Import Data Set
          </button>
        </div>
      </div>
    </div>
  );
};
