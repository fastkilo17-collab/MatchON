import React from 'react';
import { useMatchON } from '../context/MatchONContext';
import { ModelsView, useCanEditModels } from '../components/ModelsView';

export function ModelsPage() {
  const { activeTournament } = useMatchON();
  const canEdit = useCanEditModels(activeTournament);
  if (!activeTournament) return <div className="p-8 text-center text-sm text-slate-500">เลือกรายการแข่งขันก่อน</div>;
  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl font-bold text-slate-900">โมเดลนักกีฬา</h2>
        <p className="text-sm text-slate-500 mt-1">{activeTournament.name} — ตัวอย่างนักกีฬาในแต่ละรุ่น ไว้เปรียบเทียบกับตัวเองก่อนเลือกรุ่นที่จะลงแข่ง{canEdit ? '' : ' (ดูได้อย่างเดียว)'}</p>
      </div>
      <ModelsView tournament={activeTournament} editable={canEdit} />
    </div>
  );
}
