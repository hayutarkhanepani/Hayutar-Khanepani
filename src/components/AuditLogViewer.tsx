import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { AuditLog } from '../types';
import { getAuditLogs } from '../services/dbService';
import { History, Shield, RefreshCw, Clock, User, Filter } from 'lucide-react';

export const AuditLogViewer: React.FC = () => {
  const { lang, t } = useLanguage();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState('ALL');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await getAuditLogs(100);
      setLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter((l) => {
    if (filterAction === 'ALL') return true;
    return l.action.includes(filterAction);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <History className="w-5 h-5 text-purple-600" />
            <span>{lang === 'ne' ? 'अपरिवर्तनीय अडिट लग (Audit Trail)' : 'Immutable System Audit Logs'}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {lang === 'ne'
              ? 'वित्तीय पारदर्शिताको लागि महसुल जारी, काउन्टर भुक्तानी, तथा दररेट परिवर्तनका सबै रेकर्ड सुरक्षित रहन्छ।'
              : 'Tamper-proof financial and administrative activity log for transparency and audit compliance.'}
          </p>
        </div>

        <button
          onClick={fetchLogs}
          disabled={loading}
          className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>{lang === 'ne' ? 'ताजा गर्नुहोस्' : 'Refresh Logs'}</span>
        </button>
      </div>

      {/* Filter */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="font-semibold text-slate-700">{lang === 'ne' ? 'घटना प्रकार अनुसार छान्नुहोस्:' : 'Filter Action:'}</span>
        </div>
        <select
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          className="py-1.5 px-3 rounded-lg border border-slate-200 text-xs font-semibold bg-white"
        >
          <option value="ALL">All Actions</option>
          <option value="PAYMENT">Payments (RECORD_PAYMENT)</option>
          <option value="BILL">Bills (GENERATE_BILL)</option>
          <option value="HOUSEHOLD">Households (CREATE/UPDATE)</option>
          <option value="TARIFF">Tariffs & Settings</option>
        </select>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase">
              <tr>
                <th className="py-3 px-4">{lang === 'ne' ? 'समय / मिति' : 'Timestamp'}</th>
                <th className="py-3 px-4">{lang === 'ne' ? 'कार्य (Action)' : 'Action'}</th>
                <th className="py-3 px-4">{lang === 'ne' ? 'स्रोत (Entity)' : 'Resource'}</th>
                <th className="py-3 px-4">{lang === 'ne' ? 'सञ्चालक (Operator)' : 'Performed By'}</th>
                <th className="py-3 px-4">{lang === 'ne' ? 'विवरण (Details)' : 'Audit Event Details'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 italic">
                    {loading ? 'Loading audit records...' : 'No audit logs found.'}
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap font-mono text-[11px]">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-800">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-700">
                      {log.entityType} ({log.entityId})
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      <div className="font-medium text-slate-900">{log.performedBy}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{log.userEmail}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-medium">
                      {log.details}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
