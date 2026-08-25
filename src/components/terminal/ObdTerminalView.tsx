import React, { useState } from 'react';
import { OBDAdapterDriver } from '../../obd/OBDAdapterDriver';
import { UserPreferences } from '../../types';
import { getTranslation } from '../../i18n/translations';
import { Terminal, Send, Trash2 } from 'lucide-react';

interface Props {
  driver: OBDAdapterDriver | null;
  preferences: UserPreferences;
  isConnected: boolean;
}

export const ObdTerminalView: React.FC<Props> = ({ driver, preferences, isConnected }) => {
  const t = getTranslation(preferences.language);
  const isRtl = preferences.language === 'fa';

  const [inputCommand, setInputCommand] = useState<string>('');
  const [log, setLog] = useState<{ time: string; type: 'tx' | 'rx' | 'sys'; text: string }[]>([
    { time: '00:00:01', type: 'sys', text: 'MultiGauge OBD Universal Serial Terminal Initialized.' },
    { time: '00:00:02', type: 'sys', text: 'Ready for standard AT and OBD-II Mode 01-09 Hex commands.' }
  ]);

  const handleSendCommand = async (cmdToSend?: string) => {
    const cmd = (cmdToSend || inputCommand).trim().toUpperCase();
    if (!cmd || !driver || !isConnected) return;

    const time = new Date().toTimeString().split(' ')[0];
    setLog(prev => [...prev, { time, type: 'tx', text: `> ${cmd}` }]);
    setInputCommand('');

    try {
      const response = await driver.executeCommand(cmd);
      const resTime = new Date().toTimeString().split(' ')[0];
      setLog(prev => [...prev, { time: resTime, type: 'rx', text: response }]);
    } catch (err: unknown) {
      const resTime = new Date().toTimeString().split(' ')[0];
      const errMsg = err instanceof Error ? err.message : String(err);
      setLog(prev => [...prev, { time: resTime, type: 'sys', text: `ERROR: ${errMsg}` }]);
    }
  };

  const quickCommands = [
    { label: 'ATZ (Reset ELM)', cmd: 'ATZ' },
    { label: 'ATRV (Read Voltage)', cmd: 'ATRV' },
    { label: 'ATDP (Protocol)', cmd: 'ATDP' },
    { label: '0100 (Supported PIDs)', cmd: '0100' },
    { label: '010C (Read RPM)', cmd: '010C' },
    { label: '010D (Read Speed)', cmd: '010D' },
    { label: '0105 (Coolant Temp)', cmd: '0105' },
    { label: '03 (Read DTCs)', cmd: '03' }
  ];

  return (
    <div id="obd-terminal-container" className="w-full max-w-5xl flex flex-col p-2 sm:p-4 mx-auto space-y-4">
      
      {/* Header */}
      <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5 text-cyan-400" />
          <h2 className="text-base font-bold text-white">
            {t.terminal}
          </h2>
        </div>

        <button
          onClick={() => setLog([])}
          className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
        >
          <Trash2 className="w-3.5 h-3.5" />
          {isRtl ? 'پاک کردن کنسول' : 'Clear Console'}
        </button>
      </div>

      {/* Quick Command Chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        {quickCommands.map((qc) => (
          <button
            key={qc.cmd}
            onClick={() => handleSendCommand(qc.cmd)}
            disabled={!isConnected}
            className="px-2.5 py-1 bg-slate-900/80 hover:bg-cyan-950 border border-slate-800 hover:border-cyan-500 rounded-lg text-xs font-mono text-cyan-300 disabled:opacity-40 transition"
          >
            {qc.label}
          </button>
        ))}
      </div>

      {/* Console Display */}
      <div className="w-full bg-black/95 border border-slate-800 rounded-2xl p-4 font-digital text-xs sm:text-sm h-96 overflow-y-auto space-y-1.5 shadow-2xl">
        {log.map((item, idx) => (
          <div key={idx} className="flex items-start gap-2">
            <span className="text-slate-600 select-none">[{item.time}]</span>
            <span className={item.type === 'tx' ? 'text-amber-400 font-bold' : (item.type === 'rx' ? 'text-emerald-400 font-bold' : 'text-cyan-400')}>
              {item.text}
            </span>
          </div>
        ))}
      </div>

      {/* Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendCommand();
        }}
        className="flex items-center gap-2"
      >
        <input
          type="text"
          value={inputCommand}
          onChange={(e) => setInputCommand(e.target.value)}
          disabled={!isConnected}
          placeholder={isRtl ? 'دستور OBD را وارد کنید (مثال: 010C یا ATRV)...' : 'Enter OBD-II command (e.g. 010C, ATRV)...'}
          className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
        />
        <button
          type="submit"
          disabled={!isConnected || !inputCommand.trim()}
          className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition"
        >
          <Send className="w-4 h-4" />
          {isRtl ? 'ارسال' : 'Send'}
        </button>
      </form>

    </div>
  );
};
