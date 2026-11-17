import React, { useEffect, useState } from 'react';
import { CheckCircle2, Clock, MapPin, Play, RotateCcw } from 'lucide-react';
import { useMatchON } from '../context/MatchONContext';
import type { Match } from '../types/matchon';
import { matchResult, ruleForMatch, ruleText, setWinner, teamName } from '../utils/bracket';
import { ResponsiveSheet } from './UiKit';

export function MatchScoreSheet({
  match,
  onClose,
}: {
  match: Match | null;
  onClose: () => void;
}) {
  const { regMap, catMap, tRules, tCourts, recordMatchSets, updateMatchMeta } = useMatchON();
  const [setInputs, setSetInputs] = useState<[string, string][]>([
    ['', ''],
    ['', ''],
    ['', ''],
  ]);
  const [courtVal, setCourtVal] = useState<string>('');
  const [timeVal, setTimeVal] = useState<string>('');

  useEffect(() => {
    if (!match) return;
    const rule = ruleForMatch(match, Object.values(catMap), tRules);
    const n = rule.play_two ? 2 : rule.best_of || 3;
    const rows: [string, string][] = Array.from({ length: n }, (_, i) => {
      const done = match.sets[i];
      if (done) return [String(done[0]), String(done[1])];
      if (i === match.sets.length && (match.cur_a > 0 || match.cur_b > 0)) {
        return [String(match.cur_a), String(match.cur_b)];
      }
      return ['', ''];
    });
    setSetInputs(rows);
    setCourtVal(match.court ? String(match.court) : '');
    if (match.scheduled_at) {
      const d = new Date(match.scheduled_at);
      const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setTimeVal(local);
    } else {
      setTimeVal('');
    }
  }, [match, catMap, tRules]);

  if (!match) return null;

  const cat = catMap[match.category_id];
  const rule = ruleForMatch(match, Object.values(catMap), tRules);
  const teamA = teamName(match.reg_a ? regMap[match.reg_a] : null);
  const teamB = teamName(match.reg_b ? regMap[match.reg_b] : null);

  const parsedDone: [number, number][] = [];
  let openSet: [number, number] | null = null;
  let decided = false;

  for (let i = 0; i < setInputs.length && !decided; i++) {
    const [rawA, rawB] = setInputs[i];
    if (rawA === '' && rawB === '') break;
    const a = Number(rawA) || 0;
    const b = Number(rawB) || 0;
    const sw = setWinner(a, b, rule);
    if (sw) {
      parsedDone.push([a, b]);
      if (matchResult(parsedDone, rule).done) decided = true;
    } else {
      openSet = [a, b];
      break;
    }
  }

  const winnerSide = matchResult(parsedDone, rule).winner;

  const handleSaveScores = () => {
    recordMatchSets(match.id, parsedDone, openSet);
    onClose();
  };

  const handleSaveSchedule = () => {
    updateMatchMeta(match.id, {
      court: courtVal ? Number(courtVal) : null,
      scheduled_at: timeVal ? new Date(timeVal).toISOString() : null,
    });
    onClose();
  };

  return (
    <ResponsiveSheet
      open={Boolean(match)}
      onClose={onClose}
      title={`${match.match_no ? `แมตช์ #${match.match_no}` : 'รายละเอียดแมตช์'} · ${match.round_label}`}
      subtitle={`${cat?.name || ''} · ${ruleText(rule)}`}
      footer={
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-[46px] px-4 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors"
          >
            ปิด
          </button>
          <button
            type="button"
            onClick={handleSaveScores}
            disabled={!match.reg_a || !match.reg_b}
            className="flex-[2] min-h-[46px] px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-semibold transition-colors"
          >
            บันทึกคะแนน
          </button>
        </div>
      }
    >
      {/* Matchup Header */}
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className={`font-semibold ${winnerSide === 'a' ? 'text-emerald-700' : 'text-slate-900'}`}>
            {teamA}
          </span>
          <span className="text-xs text-slate-400 font-medium">ทีม A</span>
        </div>
        <div className="h-px bg-slate-200/70" />
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className={`font-semibold ${winnerSide === 'b' ? 'text-emerald-700' : 'text-slate-900'}`}>
            {teamB}
          </span>
          <span className="text-xs text-slate-400 font-medium">ทีม B</span>
        </div>
      </div>

      {/* Quick Status Controls */}
      {match.reg_a && match.reg_b && (
        <div className="flex flex-wrap items-center gap-2">
          {match.status !== 'live' && match.status !== 'finished' && (
            <button
              type="button"
              onClick={() => {
                updateMatchMeta(match.id, { status: 'live' });
                onClose();
              }}
              className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-xl bg-red-50 text-red-700 hover:bg-red-100 text-xs font-semibold transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              เริ่มแข่งทันที
            </button>
          )}
          {match.status === 'live' && (
            <button
              type="button"
              onClick={() => {
                updateMatchMeta(match.id, { status: 'scheduled' });
                onClose();
              }}
              className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-semibold transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              ส่งกลับคิวรอแข่ง
            </button>
          )}
        </div>
      )}

      {/* Set Inputs */}
      {match.reg_a && match.reg_b ? (
        <div className="space-y-3">
          <div className="text-xs font-semibold text-slate-500">กรอกคะแนนรายเซต (คำนวณผู้ชนะอัตโนมัติ)</div>
          <div className="space-y-2.5">
            {setInputs.map((pair, idx) => {
              const hidden = decided && idx >= parsedDone.length;
              if (hidden) return null;
              const a = Number(pair[0]);
              const b = Number(pair[1]);
              const hasVal = pair[0] !== '' || pair[1] !== '';
              const sw = hasVal ? setWinner(a || 0, b || 0, rule) : null;
              return (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white"
                >
                  <span className="text-xs font-semibold text-slate-600 w-12 shrink-0">เซต {idx + 1}</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={rule.cap}
                    placeholder="0"
                    value={pair[0]}
                    onChange={(e) => {
                      const next = setInputs.map((r, ri) => (ri === idx ? [e.target.value, r[1]] : r)) as [
                        string,
                        string,
                      ][];
                      setSetInputs(next);
                    }}
                    className="w-20 min-h-[44px] text-center font-mono text-base font-bold tabular-nums rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:outline-none"
                  />
                  <span className="text-slate-400 font-bold">-</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={rule.cap}
                    placeholder="0"
                    value={pair[1]}
                    onChange={(e) => {
                      const next = setInputs.map((r, ri) => (ri === idx ? [r[0], e.target.value] : r)) as [
                        string,
                        string,
                      ][];
                      setSetInputs(next);
                    }}
                    className="w-20 min-h-[44px] text-center font-mono text-base font-bold tabular-nums rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:outline-none"
                  />
                  <span className="text-xs font-medium ml-auto truncate">
                    {sw ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {sw === 'a' ? 'ทีม A ชนะ' : 'ทีม B ชนะ'}
                      </span>
                    ) : hasVal ? (
                      <span className="text-amber-600">กำลังเล่น</span>
                    ) : null}
                  </span>
                </div>
              );
            })}
          </div>
          {winnerSide && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800">
              จบแมตช์ · ผู้ชนะ: {winnerSide === 'a' ? teamA : teamB}
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-500 py-2">รอผู้ชนะจากรอบก่อนหน้าจึงจะบันทึกคะแนนได้</p>
      )}

      {/* Court & Schedule Assignment */}
      <div className="pt-3 border-t border-slate-100 space-y-3">
        <div className="text-xs font-semibold text-slate-500">กำหนดสนามและเวลาแข่งขัน</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              สนามแข่งขัน
            </span>
            <select
              value={courtVal}
              onChange={(e) => setCourtVal(e.target.value)}
              className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 bg-white text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">ยังไม่ระบุสนาม</option>
              {tCourts.map((c) => (
                <option key={c.id} value={c.no}>
                  {c.name} {c.status === 'maintenance' ? '(งดใช้)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              เวลาลงสนาม
            </span>
            <input
              type="datetime-local"
              value={timeVal}
              onChange={(e) => setTimeVal(e.target.value)}
              className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 bg-white text-sm focus:border-blue-500 focus:outline-none"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={handleSaveSchedule}
          className="w-full min-h-[42px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors"
        >
          อัปเดตเฉพาะสนามและเวลา
        </button>
      </div>
    </ResponsiveSheet>
  );
}
