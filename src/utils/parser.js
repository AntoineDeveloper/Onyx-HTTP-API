// ─── src/utils/parser.js ─────────────────────────────────────
// Parsers that turn raw Onyx Manager telnet responses into JSON.
// ──────────────────────────────────────────────────────────────

/**
 * Strip the trailing "." sentinel and trim whitespace.
 */
function clean(raw) {
  return raw
    .replace(/\r/g, '')
    .replace(/\n\.\s*$/, '')
    .trim();
}

/**
 * Parse a numbered list like QLList / CmdList / ActList / SchList.
 * Lines look like:  "00002 - SPOTS AVANT ON"
 * Returns an array of { id: number, name: string }
 */
function parseNumberedList(raw) {
  const text = clean(raw);
  const items = [];
  const re = /^(\d+)\s*-\s*(.+)$/;

  for (const line of text.split('\n')) {
    const m = line.trim().match(re);
    if (m) {
      items.push({ id: Number(m[1]), name: m[2].trim() });
    }
  }
  return items;
}

/**
 * Parse the command list which has section headers (***…***).
 */
function parseCommandList(raw) {
  const text = clean(raw);
  const sections = [];
  let currentSection = null;
  const headerRe = /^\*{3}(.+)\*{3}$/;
  const itemRe = /^(\d+)\s*-\s*(.+)$/;

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    const hm = trimmed.match(headerRe);
    if (hm) {
      currentSection = { section: hm[1].trim(), commands: [] };
      sections.push(currentSection);
      continue;
    }
    const im = trimmed.match(itemRe);
    if (im) {
      const cmd = { id: Number(im[1]), name: im[2].trim() };
      if (currentSection) {
        currentSection.commands.push(cmd);
      } else {
        // orphan – create a default section
        currentSection = { section: 'General', commands: [cmd] };
        sections.push(currentSection);
      }
    }
  }
  return sections;
}

/**
 * Parse the Status response into a structured object.
 */
function parseStatus(raw) {
  const text = clean(raw);
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const status = {
    onyxManagerId: null,
    date: null,
    time: null,
    appVersion: null,
    appStartedOn: null,
    appRunningFor: null,
    commandsSent: null,
    sunset: null,
    sunrise: null,
    timezone: null,
    position: null,
    location: null,
    currentTime: null,
    currentScheduleName: null,
    currentScheduleNo: null,
    currentEvent: null,
    schedulerRunning: false,
    onyxRunning: false,
    onyxVersion: null,
    activeCuelists: [],
    clientIp: null,
  };

  let inActiveQlist = false;

  for (const line of lines) {
    if (line.startsWith('200')) continue;
    if (line === 'Onyx Manager Status Report') continue;

    if (line.startsWith('From Onyx Manager ID:')) {
      status.onyxManagerId = line.split(':').slice(1).join(':').trim();
    } else if (line.startsWith('Date:')) {
      status.date = line.split(':').slice(1).join(':').trim();
    } else if (line.startsWith('Time:')) {
      status.time = line.split(':').slice(1).join(':').trim();
    } else if (line.startsWith('Application Version:')) {
      status.appVersion = line.split(':').slice(1).join(':').trim();
    } else if (line.startsWith('Application started on:')) {
      status.appStartedOn = line.split(':').slice(1).join(':').trim();
    } else if (line.startsWith('App Running for:')) {
      status.appRunningFor = line.split(':').slice(1).join(':').trim();
    } else if (line.startsWith('Number of Commands sent so far:')) {
      status.commandsSent = Number(line.split(':').slice(1).join(':').trim());
    } else if (line.startsWith("Today's Sunset:")) {
      status.sunset = line.split(':').slice(1).join(':').trim();
    } else if (line.startsWith("Today's Sunrise:")) {
      status.sunrise = line.split(':').slice(1).join(':').trim();
    } else if (line.startsWith('TimeZone:')) {
      status.timezone = line.split(':').slice(1).join(':').trim();
    } else if (line.startsWith('Position:')) {
      status.position = line.split(':').slice(1).join(':').trim();
    } else if (line.startsWith('Location:')) {
      status.location = line.split(':').slice(1).join(':').trim();
    } else if (line.startsWith('Current Time:')) {
      status.currentTime = line.split(':').slice(1).join(':').trim();
    } else if (line.startsWith('Current Schedule Name:')) {
      status.currentScheduleName = line.split(':').slice(1).join(':').trim();
    } else if (line.startsWith('Current Schedule No:')) {
      status.currentScheduleNo = Number(line.split(':').slice(1).join(':').trim());
    } else if (line.startsWith('Current Event:')) {
      status.currentEvent = Number(line.split(':').slice(1).join(':').trim());
    } else if (line.includes('Schedule is Stopped') || line.includes('Schedule Not Found')) {
      status.schedulerRunning = false;
    } else if (line.includes('Schedule is Running')) {
      status.schedulerRunning = true;
    } else if (line === 'Onyx Running') {
      status.onyxRunning = true;
    } else if (line.startsWith('Onyx Version:')) {
      status.onyxVersion = line.split(':').slice(1).join(':').trim();
    } else if (line === 'Onyx Active Qlist') {
      inActiveQlist = true;
    } else if (inActiveQlist && line.startsWith('- ')) {
      const m = line.match(/^-\s+(\d+)\s*-\s*(.+)$/);
      if (m) {
        status.activeCuelists.push({ id: Number(m[1]), name: m[2].trim() });
      }
    } else if (line.startsWith('Your IP is:')) {
      status.clientIp = line.split(':').slice(1).join(':').trim();
      inActiveQlist = false;
    }
  }

  return status;
}

/**
 * Parse a simple yes/no answer like IsMxRun, IsQLActive, IsSchRun.
 */
function parseYesNo(raw) {
  const text = clean(raw).toLowerCase();
  if (text.includes('yes')) return true;
  if (text.includes('no')) return false;
  return null;
}

/**
 * Parse a name response like QLName, CmdName, ActName, SchName.
 * Typically: "200 Ok\nSomeName"
 */
function parseName(raw) {
  const text = clean(raw);
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  // Skip the "200 Ok" line
  for (const line of lines) {
    if (line.startsWith('200')) continue;
    if (line.startsWith('100')) continue;
    return line;
  }
  return null;
}

/**
 * Parse the active cuelists response from QLActive.
 */
function parseActiveCuelists(raw) {
  return parseNumberedList(raw);
}

/**
 * Parse the WhoIAm response.
 */
function parseWhoIAm(raw) {
  const text = clean(raw);
  const m = text.match(/(\d+\.\d+\.\d+\.\d+)/);
  return m ? m[1] : text;
}

/**
 * Parse a simple OK/acknowledgement response.
 */
function parseOk(raw) {
  const text = clean(raw);
  return {
    ok: text.includes('200') || text.toLowerCase().includes('ok'),
    message: text.replace(/^200\s*Ok\s*/i, '').trim() || 'OK',
  };
}

/**
 * Parse SetQLLevel, SetDate, SetTime, SetPos* – just ack.
 */
function parseAck(raw) {
  return parseOk(raw);
}

/**
 * Parse the LastLog response.
 */
function parseLastLog(raw) {
  const text = clean(raw);
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  // Filter out the 200 Ok header
  return lines.filter(l => !l.startsWith('200')).map(l => l);
}

/**
 * Parse the TimePresetList response.
 */
function parseTimePresetList(raw) {
  return parseNumberedList(raw);
}

module.exports = {
  clean,
  parseNumberedList,
  parseCommandList,
  parseStatus,
  parseYesNo,
  parseName,
  parseActiveCuelists,
  parseWhoIAm,
  parseOk,
  parseAck,
  parseLastLog,
  parseTimePresetList,
};
