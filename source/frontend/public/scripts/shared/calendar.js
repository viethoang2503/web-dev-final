/** Xuất lịch sang file .ics. Giờ để dạng "floating" nên lịch hiện đúng giờ Hà Nội đã ghi. */
import { formatTime } from './schedule.js';

const pad = (value) => String(value).padStart(2, '0');

/** dateText YYYY-MM-DD + số phút trong ngày (có thể > 1440) -> YYYYMMDDTHHMMSS. */
export function icsLocalTime(dateText, minutes) {
  const [year, month, day] = dateText.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 0, minutes));
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}00`;
}

export function escapeIcsText(text) {
  return String(text ?? '').replaceAll('\\', '\\\\').replaceAll(';', '\\;').replaceAll(',', '\\,').replace(/\r?\n/g, '\\n');
}

/** Cắt dòng dài hơn 75 byte UTF-8 theo RFC 5545; dòng tiếp theo bắt đầu bằng một dấu cách. */
export function foldLine(line) {
  const encoder = new TextEncoder();
  const parts = [];
  let current = '';
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > (parts.length ? 74 : 75)) { parts.push(current); current = ''; bytes = 0; }
    current += char;
    bytes += size;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

/**
 * @param {Array<{dateText: string, items: Array<object>}>} days items lấy từ scheduleDay()
 * @param {{ now?: Date, mapsLink?: (item: object) => string }} [options]
 */
export function buildIcs(days, { now = new Date(), mapsLink } = {}) {
  const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Hanoi Local//Plan your day//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Hanoi Local plan'];
  days.forEach(({ dateText, items }, dayIndex) => {
    items.forEach((item, index) => {
      const notes = [`${formatTime(item.start)} - ${formatTime(item.end)}`];
      if (item.spot.localTip) notes.push(`Tip: ${item.spot.localTip}`);
      if (mapsLink) notes.push(`Directions: ${mapsLink(item)}`);
      notes.push(...item.warnings);
      lines.push(
        'BEGIN:VEVENT',
        `UID:${item.spot.id}-${dateText}-${dayIndex}${index}@hanoi-local`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${icsLocalTime(dateText, item.start)}`,
        `DTEND:${icsLocalTime(dateText, item.end)}`,
        `SUMMARY:${escapeIcsText(item.spot.kind === 'food' ? `${item.spot.name} at ${item.name}` : item.spot.name)}`,
        `LOCATION:${escapeIcsText([item.name, item.address, 'Hanoi, Vietnam'].filter(Boolean).join(', '))}`,
        `DESCRIPTION:${escapeIcsText(notes.join('\n'))}`,
        'END:VEVENT',
      );
    });
  });
  lines.push('END:VCALENDAR');
  return `${lines.map(foldLine).join('\r\n')}\r\n`;
}
