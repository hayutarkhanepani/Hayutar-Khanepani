import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { WardInfo, Household } from '../types';
import { saveWard, deleteWard } from '../services/dbService';
import {
  Layers,
  MapPin,
  Plus,
  Trash2,
  Edit,
  CheckCircle2,
  Users,
  AlertCircle,
  X,
} from 'lucide-react';

interface WardToleManagementProps {
  wards: WardInfo[];
  households: Household[];
  onRefresh: () => void;
}

export const WardToleManagement: React.FC<WardToleManagementProps> = ({
  wards,
  households,
  onRefresh,
}) => {
  const { lang, t } = useLanguage();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWard, setEditingWard] = useState<WardInfo | null>(null);

  const [wardNumber, setWardNumber] = useState('');
  const [wardName, setWardName] = useState('');
  const [tolesText, setTolesText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const openAddModal = () => {
    setEditingWard(null);
    setWardNumber(String(wards.length + 1));
    setWardName(`वडा नं ${wards.length + 1}`);
    setTolesText('');
    setError('');
    setIsModalOpen(true);
  };

  const openEditModal = (w: WardInfo) => {
    setEditingWard(w);
    setWardNumber(w.wardNumber);
    setWardName(w.name);
    setTolesText(w.toles.join(', '));
    setError('');
    setIsModalOpen(true);
  };

  const handleSaveWard = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      if (!wardNumber.trim() || !wardName.trim()) {
        throw new Error('Ward number and name are required.');
      }

      const toles = tolesText
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const wardId = editingWard ? editingWard.id : `ward-${wardNumber.trim()}`;
      const wardData: WardInfo = {
        id: wardId,
        wardNumber: wardNumber.trim(),
        name: wardName.trim(),
        toles: toles.length > 0 ? toles : ['Main Tole'],
        updatedAt: new Date().toISOString(),
        createdAt: editingWard?.createdAt || new Date().toISOString(),
      };

      await saveWard(wardData);
      setIsModalOpen(false);
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Error saving ward.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteWard = async (wardId: string) => {
    if (!window.confirm('Are you sure you want to delete this ward?')) return;
    try {
      await deleteWard(wardId);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-sky-600" />
            <span>{lang === 'ne' ? 'वडा तथा टोल व्यवस्थापन' : 'Ward & Tole Geographic Registry'}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {lang === 'ne'
              ? 'खानेपानी वितरण क्षेत्र, वडाहरू, टोल/बस्ती तथा क्षेत्रीय कर्मचारीको कार्यक्षेत्र व्यवस्थापन।'
              : 'Configure service wards, villages/toles, and monitor consumer household density per ward.'}
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{lang === 'ne' ? 'नयाँ वडा थप्नुहोस्' : 'Add New Ward'}</span>
        </button>
      </div>

      {/* Ward Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {wards.map((w) => {
          const wardHouseholds = households.filter((h) => h.ward === w.wardNumber);
          const activeCount = wardHouseholds.filter((h) => h.status === 'ACTIVE').length;
          const inactiveCount = wardHouseholds.filter((h) => h.status === 'INACTIVE').length;

          return (
            <div
              key={w.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start">
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 font-mono">
                    Ward No. {w.wardNumber}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(w)}
                      className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg"
                      title="Edit Ward"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteWard(w.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                      title="Delete Ward"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <h3 className="font-bold text-slate-900 text-base mt-2">{w.name}</h3>

                {/* Household counts */}
                <div className="mt-3 flex items-center gap-3 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-1 text-slate-700">
                    <Users className="w-3.5 h-3.5 text-sky-600" />
                    <span className="font-semibold">{wardHouseholds.length}</span> households
                  </div>
                  <span className="text-slate-300">•</span>
                  <span className="text-emerald-700 font-medium">{activeCount} active</span>
                  {inactiveCount > 0 && (
                    <>
                      <span className="text-slate-300">•</span>
                      <span className="text-slate-500">{inactiveCount} inactive</span>
                    </>
                  )}
                </div>

                {/* Toles list */}
                <div className="mt-4 space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    {lang === 'ne' ? 'टोल तथा बस्तीहरू:' : 'Toles & Villages:'}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {w.toles.map((tole, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 bg-slate-100 text-slate-700 text-xs rounded-lg font-medium flex items-center gap-1"
                      >
                        <MapPin className="w-3 h-3 text-sky-600 shrink-0" />
                        <span>{tole}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex justify-between items-center">
                <span>{lang === 'ne' ? 'क्षेत्रीय पहुँच लागू' : 'Role Scoped'}</span>
                <span className="text-sky-700 font-semibold">{w.inchargeStaffName || 'Staff Assigned'}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">
                {editingWard
                  ? (lang === 'ne' ? 'वडा विवरण सम्पादन' : 'Edit Ward')
                  : (lang === 'ne' ? 'नयाँ वडा थप्नुहोस्' : 'Add New Ward')}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSaveWard} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {lang === 'ne' ? 'वडा नम्बर (Ward Number)' : 'Ward Number'} *
                </label>
                <input
                  type="text"
                  required
                  value={wardNumber}
                  onChange={(e) => setWardNumber(e.target.value)}
                  placeholder="e.g. 1"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {lang === 'ne' ? 'वडाको नाम (Ward Name / Label)' : 'Ward Name / Label'} *
                </label>
                <input
                  type="text"
                  required
                  value={wardName}
                  onChange={(e) => setWardName(e.target.value)}
                  placeholder="e.g. वडा नं १ (Ward 1 - Bazar Area)"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {lang === 'ne' ? 'टोल / बस्तीहरू (अल्पविरामले छुट्याउनुहोस्)' : 'Toles / Villages (Comma separated)'}
                </label>
                <textarea
                  rows={3}
                  value={tolesText}
                  onChange={(e) => setTolesText(e.target.value)}
                  placeholder="Bazar Tole, Dharapani, Mul Basti"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-xs font-semibold text-white shadow-xs cursor-pointer"
                >
                  {saving ? 'Saving...' : t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
