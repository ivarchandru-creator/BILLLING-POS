import React, { useState, useEffect } from 'react';

interface RunningLiveClockProps {
  className?: string;
}

export const RunningLiveClock: React.FC<RunningLiveClockProps> = ({
  className = '',
}) => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Format 12-hour running time with AM/PM
  let hours = now.getHours();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const hoursStr = String(hours).padStart(2, '0');
  const minutesStr = String(now.getMinutes()).padStart(2, '0');
  const secondsStr = String(now.getSeconds()).padStart(2, '0');

  // Format date e.g. "Sunday, 20 Sep 2026"
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  const dayName = dayNames[now.getDay()];
  const dateNum = String(now.getDate()).padStart(2, '0');
  const monthName = monthNames[now.getMonth()];
  const year = now.getFullYear();

  return (
    <div
      id="running-time-date-container"
      className={`px-4 py-2.5 border-t border-slate-100 flex flex-col justify-center select-none ${className}`}
    >
      <div className="font-mono text-sm font-bold text-slate-900 tracking-tight tabular-nums">
        {hoursStr}:{minutesStr}:{secondsStr} {ampm}
      </div>
      <div className="text-xs text-slate-500 font-medium">
        {dayName}, {dateNum} {monthName} {year}
      </div>
    </div>
  );
};
