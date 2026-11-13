import {
  FlowchartHourBlock,
  FlowchartStep,
  ProgramCategory,
  ProgramFlowchart,
  RadioProgram,
} from '../types';

export const PROGRAM_CATEGORIES: ProgramCategory[] = [
  'Daily & Weekly Programs',
  'Weekend Program',
  'Ramadan Program',
];

const STANDARD_ADDITIONAL_NOTES = [
  'Adzan digunakan pas kengeran adzan (cabang kondisi saat masuk waktu sholat).',
  'Setelah adzan, wajib pasang Lensa Islam.',
  'Music Montage jenis apapun boleh digunakan di program apapun.',
  '*NOTE: Masukkan Playlist Program berikutnya di akhir siaran agar tidak dead air.',
];

interface TwoHourSpec {
  id: string;
  sourceFile: string;
  headerTitle: string;
  programShort: string;
  vibesLagu: string;
  reminders: string[];
  hasNewsBlocks?: boolean;
  hasShortlyDeeplydoo?: boolean;
  h1StartLabel: string;
  h1EndTime: string;
  h1Segmen: string;
  h1SegmenSweeper: string;
  h1Talk1: string;
  h1Talk2: string;
  h1Talk3: string;
  h1Closing: string;
  h1Times: { cross: string; toh: string; t1: string; t2: string; t3: string; close: string; spot1?: string; news1?: string; news2a?: string; news2b?: string };
  h1Spot1Desc: string;
  h1Spot2Desc: string;
  h1Songs: string[];
  h2StartLabel: string;
  h2EndTime: string;
  h2Segmen: string;
  h2SegmenSweeper: string;
  h2Talk1: string;
  h2Talk2: string;
  h2Talk3: string;
  h2Closing: string;
  h2Times: { cross: string; toh: string; t1: string; t2: string; t3: string; close: string; spot1?: string; news1?: string; news2a?: string; news2b?: string };
  h2Spot1Desc: string;
  h2Spot2Desc: string;
  h2Songs: string[];
  preSteps?: FlowchartStep[];
  verificationNotes?: string[];
}

function songStep(id: string, num: number, desc: string, time?: string): FlowchartStep {
  return {
    id,
    slot: 'Song',
    content: `Song ${num}`,
    description: desc,
    time,
    kind: 'song',
  };
}

function buildHourBlock(
  prefix: string,
  hourTitle: string,
  segmentLabel: string,
  timeRange: string,
  progShort: string,
  segSweeper: string,
  tohName: string,
  talks: { t1: string; t2: string; t3: string; close: string },
  times: { cross: string; toh: string; t1: string; t2: string; t3: string; close: string; spot1?: string; news1?: string; news2a?: string; news2b?: string },
  spot1Desc: string,
  spot2Desc: string,
  songs: string[],
  songStartNum: number,
  options: { hasNews?: boolean; hasShortly?: boolean; sweeperProgOverride?: string; tohDescOverride?: string }
): FlowchartHourBlock {
  const steps: FlowchartStep[] = [
    {
      id: `${prefix}-cross`,
      slot: 'Break',
      content: 'Cross Promo',
      description: `Cross Promo Program ${progShort}`,
      time: times.cross,
      kind: 'break',
    },
    {
      id: `${prefix}-ilm`,
      slot: 'Promo',
      content: 'ILM',
      description: 'Iklan Layanan Masyarakat',
      kind: 'break',
    },
    {
      id: `${prefix}-jingle`,
      slot: 'JINGLE',
      content: 'JINGLE',
      description: 'JINGLE SIMFONI FM',
      kind: 'break',
    },
    {
      id: `${prefix}-toh`,
      slot: 'TOH',
      content: tohName,
      description: options.tohDescOverride || `TOH ${progShort} (Opening, say hi, time check - max 1 min)`,
      time: times.toh,
      kind: 'toh',
    },
    {
      id: `${prefix}-swp-prog`,
      slot: 'Sweeper',
      content: 'Sweeper Program',
      description: options.sweeperProgOverride || `Sweeper Program ${progShort}`,
      kind: 'sweeper',
    },
    songStep(`${prefix}-s1`, songStartNum, songs[0] || 'Sesuai vibes'),
    songStep(`${prefix}-s2`, songStartNum + 1, songs[1] || 'Sesuai vibes'),
    {
      id: `${prefix}-swp-seg1`,
      slot: 'Sweeper',
      content: 'Sweeper Segmen',
      description: `Sweeper Segmen ${segSweeper}`,
      kind: 'sweeper',
    },
    {
      id: `${prefix}-talk1`,
      slot: 'Talkset',
      content: 'Talk 1',
      description: talks.t1,
      time: times.t1,
      kind: 'talkset',
    },
    {
      id: `${prefix}-mm1`,
      slot: 'Break',
      content: 'Music Montage',
      description: 'Music Montage',
      kind: 'break',
    },
  ];

  if (options.hasShortly) {
    steps.push({
      id: `${prefix}-shortly1`,
      slot: 'Break',
      content: 'Shortly Deeplydoo',
      description: 'Shortly Deeplydoo',
      kind: 'break',
    });
  }

  if (options.hasNews) {
    steps.push({
      id: `${prefix}-news1`,
      slot: 'News',
      content: 'Simfoni FM Lalu Lalang',
      description: 'Traffic Info from Google Maps and listeners report (max 1 min)',
      time: times.news1,
      kind: 'news',
    });
  }

  // Between Talk 1 and Talk 2 songs (2 songs if news/regular daily, 3 songs if weekend/daebak/etc. when length matches)
  const preTalk2Count = songs.length >= 15 ? 3 : 2;
  let cursor = 2;
  for (let i = 0; i < preTalk2Count && cursor < songs.length; i++) {
    steps.push(songStep(`${prefix}-s${cursor + 1}`, songStartNum + cursor, songs[cursor]));
    cursor++;
  }

  steps.push(
    {
      id: `${prefix}-swp-seg2`,
      slot: 'Sweeper',
      content: 'Sweeper Segmen',
      description: `Sweeper Segmen ${segSweeper}`,
      kind: 'sweeper',
    },
    {
      id: `${prefix}-talk2`,
      slot: 'Talkset',
      content: 'Talk 2',
      description: talks.t2,
      time: times.t2,
      kind: 'talkset',
    },
    {
      id: `${prefix}-spot1`,
      slot: 'Break',
      content: 'Spot/Promo',
      description: spot1Desc,
      time: times.spot1,
      kind: 'break',
    },
    {
      id: `${prefix}-mm2`,
      slot: 'Break',
      content: 'Music Montage',
      description: 'Music Montage',
      kind: 'break',
    }
  );

  if (options.hasShortly) {
    steps.push({
      id: `${prefix}-shortly2`,
      slot: 'Break',
      content: 'Shortly Deeplydoo',
      description: 'Shortly Deeplydoo',
      kind: 'break',
    });
  }

  const preTalk3Count = songs.length >= 14 ? 2 : 3;
  for (let i = 0; i < preTalk3Count && cursor < songs.length; i++) {
    steps.push(songStep(`${prefix}-s${cursor + 1}`, songStartNum + cursor, songs[cursor]));
    cursor++;
  }

  // Wait: if total songs in this hour is 15 (Weekend/Ramadan) vs 12 (Daily):
  // Weekend/Ramadan has: 2 (before T1), 3 (T1-T2), 2 (T2-T3), 3 (T3-Adlibs), 2 (Spot2-Close), 3 (after Close) = 15 songs!
  // Daily (12 songs) has: 2 (before T1), 2 (T1-T2), 3 (T2-T3), 2 (T3-Adlibs), 0 (before Close), 3 (after Close) = 12 songs!
  // HK/Freeline (14 songs) has: 2 (before T1), 2 (T1-T2), 3 (T2-T3), 2 (T3-Adlibs), 2 (Spot2-Close), 3 (after Close) = 14 songs!
  // Let's handle exact counts per song array length!
  if (songs.length === 12) {
    // Daily 12-song layout actually had 3 songs between T2 and T3! Add 1 more before swp-seg3
    steps.push(songStep(`${prefix}-s${cursor + 1}`, songStartNum + cursor, songs[cursor]));
    cursor++;
  } else if (songs.length === 14) {
    // 14-song layout (HK, Freeline, KURMA) also has 3 songs between T2 and T3!
    steps.push(songStep(`${prefix}-s${cursor + 1}`, songStartNum + cursor, songs[cursor]));
    cursor++;
  } else if (songs.length === 13) {
    // ED/YA (13 songs)
    steps.push(songStep(`${prefix}-s${cursor + 1}`, songStartNum + cursor, songs[cursor]));
    cursor++;
  }

  steps.push(
    {
      id: `${prefix}-swp-seg3`,
      slot: 'Sweeper',
      content: 'Sweeper Segmen',
      description: `Sweeper Segmen ${segSweeper}`,
      kind: 'sweeper',
    },
    {
      id: `${prefix}-talk3`,
      slot: 'Talkset',
      content: 'Talk 3',
      description: talks.t3,
      time: times.t3,
      kind: 'talkset',
    }
  );

  const postTalk3Count = songs.length === 15 || songs.length === 13 ? 3 : 2;
  for (let i = 0; i < postTalk3Count && cursor < songs.length; i++) {
    steps.push(songStep(`${prefix}-s${cursor + 1}`, songStartNum + cursor, songs[cursor]));
    cursor++;
  }

  steps.push(
    {
      id: `${prefix}-greeting`,
      slot: 'Break',
      content: 'Greeting',
      description: 'Greeting pendengar',
      kind: 'adlibs',
    },
    {
      id: `${prefix}-adlibs`,
      slot: 'Decision',
      content: 'Adlibs Marketing *(Optional bila ada)',
      description: 'Cabang kondisi: Jika ada jadwal Adlibs Marketing, bacakan Adlibs; jika tidak ada, lanjut langsung.',
      kind: 'decision',
      isConditional: true,
      branchYesLabel: 'Ada jadwal -> Bacakan Adlibs Marketing',
      branchNoLabel: 'Tidak ada -> Lanjut ke slot berikutnya',
    }
  );

  if (options.hasNews) {
    steps.push(
      {
        id: `${prefix}-news-hl`,
        slot: 'News',
        content: 'Simfoni Highlight',
        description: 'News (Simfoni Highlight)',
        time: times.news2a,
        kind: 'news',
      },
      {
        id: `${prefix}-news-ll`,
        slot: 'News',
        content: 'Lalu Lalang',
        description: 'Traffic from Google Maps and listeners report, max 1 min',
        time: times.news2b,
        kind: 'news',
      }
    );
  }

  steps.push({
    id: `${prefix}-spot2`,
    slot: 'Break',
    content: 'Spot/Promo',
    description: spot2Desc,
    kind: 'break',
  });

  if (options.hasNews) {
    steps.push({
      id: `${prefix}-mm3`,
      slot: 'Break',
      content: 'Music Montage',
      description: 'Music Montage',
      kind: 'break',
    });
  }

  // Remaining songs before Closing (usually 0 for 12-song Daily, 2 for 14/15-song, leaving last 3 for after Closing)
  const remainingBeforeClose = Math.max(0, songs.length - cursor - 3);
  for (let i = 0; i < remainingBeforeClose && cursor < songs.length; i++) {
    steps.push(songStep(`${prefix}-s${cursor + 1}`, songStartNum + cursor, songs[cursor]));
    cursor++;
  }

  steps.push(
    {
      id: `${prefix}-swp-seg4`,
      slot: 'Sweeper',
      content: 'Sweeper Segmen',
      description: `Sweeper Segmen ${segSweeper}`,
      kind: 'sweeper',
    },
    {
      id: `${prefix}-closing`,
      slot: 'Talkset',
      content: tohName === 'TOH' ? 'Closing 1st hour' : 'Closing 2nd hour',
      description: talks.close,
      time: times.close,
      kind: 'talkset',
    }
  );

  while (cursor < songs.length) {
    steps.push(songStep(`${prefix}-s${cursor + 1}`, songStartNum + cursor, songs[cursor]));
    cursor++;
  }

  // Conditional Adzan node at end of hour block for clear visual branching
  steps.push({
    id: `${prefix}-adzan-branch`,
    slot: 'Decision',
    content: 'Cek Waktu Adzan (Kondisional)',
    description: 'Adzan digunakan pas kedengeran adzan. Setelah adzan selesai, wajib pasang Lensa Islam.',
    kind: 'decision',
    isConditional: true,
    branchYesLabel: 'Masuk Adzan -> Putar Adzan -> Pasang Lensa Islam',
    branchNoLabel: 'Belum Adzan -> Lanjut ke jam / program berikutnya',
  });

  return {
    id: `${prefix}-hour`,
    hourTitle,
    segmentLabel,
    timeRange,
    steps,
  };
}

function makeTwoHourFlowchart(spec: TwoHourSpec): ProgramFlowchart {
  const h1 = buildHourBlock(
    `${spec.id}-h1`,
    spec.h1StartLabel,
    spec.h1Segmen,
    spec.h1EndTime,
    spec.programShort,
    spec.h1SegmenSweeper,
    'TOH',
    {
      t1: spec.h1Talk1,
      t2: spec.h1Talk2,
      t3: spec.h1Talk3,
      close: spec.h1Closing,
    },
    spec.h1Times,
    spec.h1Spot1Desc,
    spec.h1Spot2Desc,
    spec.h1Songs,
    1,
    {
      hasNews: spec.hasNewsBlocks,
      hasShortly: spec.hasShortlyDeeplydoo,
    }
  );

  if (spec.preSteps && spec.preSteps.length > 0) {
    h1.steps = [...spec.preSteps, ...h1.steps];
  }

  const h2 = buildHourBlock(
    `${spec.id}-h2`,
    spec.h2StartLabel,
    spec.h2Segmen,
    spec.h2EndTime,
    spec.programShort,
    spec.h2SegmenSweeper,
    'TOH Segment 2',
    {
      t1: spec.h2Talk1,
      t2: spec.h2Talk2,
      t3: spec.h2Talk3,
      close: spec.h2Closing,
    },
    spec.h2Times,
    spec.h2Spot1Desc,
    spec.h2Spot2Desc,
    spec.h2Songs,
    spec.h1Songs.length + 1,
    {
      hasNews: spec.hasNewsBlocks,
      hasShortly: spec.hasShortlyDeeplydoo,
    }
  );

  return {
    id: spec.id,
    sourceFile: spec.sourceFile,
    headerTitle: spec.headerTitle,
    vibesLagu: spec.vibesLagu,
    reminders: spec.reminders,
    additionalNotes: STANDARD_ADDITIONAL_NOTES,
    hours: [h1, h2],
    verificationNotes: spec.verificationNotes,
  };
}

// Build Simfoni Weekend Show (4-Hour Program) cleanly from FLOWCHART_2026__WEEKEND__5aafd235.pdf
const SWS_FLOWCHART: ProgramFlowchart = {
  id: 'sws-flow',
  sourceFile: 'FLOWCHART_2026__WEEKEND__5aafd235.pdf',
  headerTitle: 'Simfoni Weekend Show (SATURDAY & SUNDAY 06:00 - 12:00 WIB)',
  vibesLagu: 'Up Beat / Power Up / Cheerful Hits Song',
  reminders: [
    'Segmen 1: 08.00 - 09.00 (WEKER)',
    'Segmen 2: 09.00 - 10.00 (Rekomendasi sarapan)',
    'Segmen 3: 10.00 - 11.00 (Lifestyle)',
    'Segmen 4: 11.00 - 12.00 (Entertainment)',
  ],
  additionalNotes: STANDARD_ADDITIONAL_NOTES,
  verificationNotes: [
    'Panduan menulis jam 08.00–12.00, sedangkan Flowchart Weekend menulis 06:00–12:00 WIB (Playlist By MO jam 06:00, Indonesia Raya jam 08:00, TOH jam 08:10).',
  ],
  hours: [
    (() => {
      const h1 = buildHourBlock(
        'sws-h1',
        'Jam Siar 1 (08.00 - 09.00)',
        'Segmen 1: WEKER (Request lagu dan kirim salam)',
        '08:00 - 09:00',
        'Simfoni Weekend Show',
        'WEKER',
        'TOH',
        {
          t1: 'Introduce WEKER (Waktunya request dan kirim salam - max 1 min)',
          t2: 'Ajakin gabungan Sobat Muda di segmen WEKER (waktunya request dan kirim salam)',
          t3: 'Bacain gabungan Sobat Muda di segmen WEKER (waktunya request dan kirim salam)',
          close: 'Closing Hour, Promises Next Hour, max 1 min',
        },
        { cross: '8:05', toh: '8:10', t1: '8:17', t2: '8:30', t3: '8:40', close: '8:55' },
        'Spot/Promo Program',
        'Spot/Promo Program',
        [
          'Manca', 'Indo', 'Indo', 'Manca', 'Indo',
          'Indo', 'Manca', 'Indo', 'Manca', 'Korea',
          'Manca', 'Indo', 'Indo', 'Manca', 'Indo',
        ],
        1,
        { hasNews: false, hasShortly: false }
      );
      h1.steps = [
        {
          id: 'sws-playlist-mo',
          slot: 'Start',
          content: 'PLAYLIST SIMFONI Weekend SHOW (By MO)',
          description: 'Putar playlist pembuka sebelum penyiar masuk',
          time: '6:00',
          kind: 'start',
        },
        {
          id: 'sws-indo-raya',
          slot: 'Song',
          content: 'Indonesia Raya',
          description: 'Penyiar memutarkan Lagu Indonesia Raya',
          time: '8:00',
          kind: 'song',
        },
        ...h1.steps,
      ];
      return h1;
    })(),
    buildHourBlock(
      'sws-h2',
      'Jam Siar 2 (09.00 - 10.00)',
      'Segmen 2: Rekomendasi Sarapan',
      '09:00 - 10:00',
      'Simfoni Weekend Show',
      'Rekomendasi Sarapan',
      'TOH Segment 2',
      {
        t1: 'Spoiler Rekomendasi Sarapan segment (What is Rekomendasi Sarapan for today?)',
        t2: 'Bahas Rekomendasi Sarapan',
        t3: 'Bahas Rekomendasi Sarapan',
        close: 'Closing Hour, Promises Next Hour, max 1 min',
      },
      { cross: '9:05', toh: '9:10', t1: '9:17', t2: '9:30', t3: '9:40', close: '9:55' },
      'Spot/Promo Program Mixer',
      'Spot/Promo Program Daebak',
      [
        'Indo', 'Manca', 'Indo', 'Manca', 'Korea',
        'Manca', 'Indo', 'Indo', 'Manca', 'Indo',
        'Indo', 'Manca', 'Indo', 'Manca', 'Korea',
      ],
      16,
      { hasNews: false, hasShortly: false }
    ),
    buildHourBlock(
      'sws-h3',
      'Jam Siar 3 (10.00 - 11.00)',
      'Segmen 3: Lifestyle',
      '10:00 - 11:00',
      'Simfoni Weekend Show',
      'Lifestyle',
      'TOH Segment 3',
      {
        t1: 'Spoiler - max 1 min',
        t2: 'Bahas Lifestyle',
        t3: 'Bahas Lifestyle',
        close: 'Closing Hour, Promises Next Hour, max 1 min',
      },
      { cross: '10:05', toh: '10:10', t1: '10:17', t2: '10:30', spot1: '8:32', t3: '10:40', close: '10:55' },
      'Spot/Promo Program Mizan',
      'Spot/Promo Program Soda',
      [
        'Manca', 'Indo', 'Indo', 'Manca', 'Indo',
        'Indo', 'Manca', 'Indo', 'Manca', 'Korea',
        'Manca', 'Indo', 'Indo', 'Manca', 'Indo',
      ],
      31,
      { hasNews: false, hasShortly: false }
    ),
    buildHourBlock(
      'sws-h4',
      'Jam Siar 4 (11.00 - 12.00)',
      'Segmen 4: Entertainment',
      '11:00 - 12:00',
      'Simfoni Weekend Show',
      'Entertainment',
      'TOH Segment 4',
      {
        t1: 'Spoiler',
        t2: 'Bahas Entertainment',
        t3: 'Bahas Entertainment',
        close: 'Closing Hour, Promises Next Hour, max 1 min',
      },
      { cross: '11:05', toh: '11:10', t1: '11:17', t2: '11:30', t3: '11:40', close: '11:55' },
      'Spot/Promo Program Freeline',
      'Spot/Promo Program Fresh Sunday',
      [
        'Indo', 'Manca', 'Indo', 'Manca', 'Korea',
        'Manca', 'Indo', 'Indo', 'Manca', 'Indo',
        'Indo', 'Manca', 'Indo', 'Manca', 'Korea',
      ],
      46,
      { hasNews: false, hasShortly: false }
    ),
  ],
};

export const PROGRAM_FLOWCHARTS: Record<string, ProgramFlowchart> = {
  'sms-flow': makeTwoHourFlowchart({
    id: 'sms-flow',
    sourceFile: 'FLOWCHART_2026__DAILY__b1858a82.pdf',
    headerTitle: "SIMFONI MORNING SHOW (Senin - Jum'at jam 08.00 - 10.00)",
    programShort: 'Simfoni Morning Show',
    vibesLagu: 'Up Beat / Power Up / Cheerful Hits Song',
    reminders: ['Checklist: IGStory, Twitter', '*cek jadwal Spot/Adlibs marketing (kalo gaada bebas)', 'Reminder akhir: Traffic'],
    hasNewsBlocks: true,
    h1StartLabel: 'Jam Siar 1 (08.00 - 09.00)',
    h1EndTime: '08:05 - 09:00',
    h1Segmen: 'Segmen 1: WEKER (Kirim salam dan request lagu)',
    h1SegmenSweeper: 'WEKER',
    h1Talk1: 'Introduce WEKER (Waktunya request dan kirim salam - max 1 min)',
    h1Talk2: 'Ajakin gabungan Sobat Muda di segmen WEKER (waktunya request dan kirim salam)',
    h1Talk3: 'Bacain gabungan Sobat Muda di segmen WEKER (waktunya request dan kirim salam)',
    h1Closing: 'Closing Hour, Promises Next Hour, max 1 min',
    h1Times: { cross: '8:05', toh: '8:10', t1: '8:17', news1: '8:20', t2: '8:30', t3: '8:40', news2a: '8:50', news2b: '8:52', close: '8:55' },
    h1Spot1Desc: 'Spot/Promo Program',
    h1Spot2Desc: 'Spot/Promo Program',
    h1Songs: [
      'CHR Manca (middle)', 'URBAN Indo (middle)', 'CHR Indo (Middle)', 'URBAN Manca (Middle)',
      'CHR Indo (Middle Up)', 'URBAN Manca (Middle Up)', 'URBAN INDO (Middle Up)', 'CHR Indo (Middle Up)',
      'CHR Manca (Middle Up)', 'A/C Manca (Up Beat)', 'A/C Indo (Up Beat)',
    ],
    h2StartLabel: 'Jam Siar 2 (09.00 - 10.00)',
    h2EndTime: '09:05 - 10:00',
    h2Segmen: 'Segmen 2: Yay or Nay',
    h2SegmenSweeper: 'YAY or NAY',
    h2Talk1: 'Introduce YAY or NAY segment (What is YAY or NAY for today?)',
    h2Talk2: 'Ask Sobat Muda to join Yay or Nay',
    h2Talk3: 'Bacain gabungan Sobat Muda yang join YAY or NAY, from Instagram + Pendapat masing²',
    h2Closing: 'Closing Hour, Promises Next Hour, max 1 min',
    h2Times: { cross: '9:05', toh: '9:10', t1: '9:17', news1: '9:20', t2: '9:30', spot1: '9:32', t3: '9:40', news2a: '9:50', news2b: '9:52', close: '9:55' },
    h2Spot1Desc: 'Spot/Promo Program',
    h2Spot2Desc: 'Spot/Promo Program',
    h2Songs: [
      'URBAN Manca (Up Beat)', 'CHR Indo (Up Beat)', 'URBAN Indo (Up Beat)', 'URBAN Manca (Up Beat)',
      'CHR Manca (Middle Up)', 'URBAN Manca (Middle Up)', 'CHR Indo (Up Beat)', 'A/C Manca (Middle Up)',
      'A/C Indo (Middle Up)', 'CHR Manca (Middle Up)', 'URBAN MANCA (Middle Up)', 'URBAN Indo (Up Beat)',
    ],
  }),

  'freetime-flow': makeTwoHourFlowchart({
    id: 'freetime-flow',
    sourceFile: 'FLOWCHART_2026__DAILY__b1858a82.pdf',
    headerTitle: "FREETIME (Senin - Jum'at jam 10.00 - 12.00)",
    programShort: 'Freetime',
    vibesLagu: 'Up Beat / Power Up / Cheerful Hits Song',
    reminders: ['Checklist: IGStory, Twitter', 'Reminder akhir: Traffic'],
    hasNewsBlocks: true,
    h1StartLabel: 'Jam Siar 1 (10.00 - 11.00)',
    h1EndTime: '10:05 - 11:00',
    h1Segmen: 'Segmen 1: Tips n Trick (TnT)',
    h1SegmenSweeper: 'Tips Trick',
    h1Talk1: 'Spoiler Segmen Tips Trick',
    h1Talk2: 'Tips Trick',
    h1Talk3: 'Tips Trick',
    h1Closing: 'Closing Hour, Promises Next Hour, max 1 min',
    h1Times: { cross: '10:05', toh: '10:10', t1: '10:17', news1: '10:20', t2: '10:30', spot1: '10:32', t3: '10:40', news2a: '10:50', news2b: '10:52', close: '10:55' },
    h1Spot1Desc: 'Spot/Promo Program',
    h1Spot2Desc: 'Spot/Promo Program',
    h1Songs: [
      'CHR Manca (Middle Up)', 'URBAN Indo (Middle Up)', 'CHR Indo (Middle Up)', 'CHR Manca (Middle)',
      'CHR Indo (Middle)', 'A/C Indo (Middle)', 'A/C Manca (Middle)', 'URBAN Indo (Middle Up)',
      'URBAN Manca (Middle Up)', 'URBAN Manca (Up Beat)', 'URBAN Indo (Up Beat)', 'CHR Indo (Up Beat)',
    ],
    h2StartLabel: 'Jam Siar 2 (11.00 - 12.00)',
    h2EndTime: '11:05 - 12:00',
    h2Segmen: 'Segmen 2: RELA (Rekomendasi Lagu)',
    h2SegmenSweeper: 'RELA',
    h2Talk1: 'Introduce RELA segment (rekomendasi lagu)',
    h2Talk2: 'Ask Sobat Muda to join RELA',
    h2Talk3: 'Bacain hasil battle Sobat Muda yang join RELA, from Instagram',
    h2Closing: 'Closing Hour, Promises Next Hour, max 1 min',
    h2Times: { cross: '11:05', toh: '11:10', t1: '11:17', news1: '11:20', t2: '11:30', spot1: '11:32', t3: '11:40', news2a: '11:50', news2b: '11:52', close: '11:55' },
    h2Spot1Desc: 'Spot/Promo Program',
    h2Spot2Desc: 'Spot/Promo Program',
    h2Songs: [
      'CHR Manca (Up Beat)', 'CHR Indo (Up Beat)', 'CHR Indo (Middle Up)', 'URBAN Manca (Middle Up)',
      'URBAN Manca (Middle Up)', 'URBAN Indo (Middle)', 'URBAN Manca (Middle Up)', 'CHR Indo (Middle)',
      'CHR Indo (Middle)', 'Play Lagu RELA', 'CHR Manca (Middle)', 'URBAN Indo (Slow)',
    ],
  }),

  'rnr-flow': makeTwoHourFlowchart({
    id: 'rnr-flow',
    sourceFile: 'FLOWCHART_2026__DAILY__b1858a82.pdf',
    headerTitle: "Rest and Relax (Senin - Jum'at jam 12.00 - 14.00)",
    programShort: 'RNR',
    vibesLagu: 'Chill, Relax, Indie, Calm, Medium Beat, slow',
    reminders: ['Checklist: IGStory, Twitter', 'Reminder akhir: Traffic', 'Catatan Panduan: Segmen 1 REMAS saat Ramadhan diganti fakta unik'],
    hasNewsBlocks: true,
    h1StartLabel: 'Jam Siar 1 (12.00 - 13.00)',
    h1EndTime: '12:05 - 13:00',
    h1Segmen: 'Segmen 1: REMAS (Rekomendasi Makan Siang)',
    h1SegmenSweeper: 'REMAS',
    h1Talk1: 'Spoiler REMAS (rekomendasi makan siang)',
    h1Talk2: 'REMAS (rekomendasi makan siang)',
    h1Talk3: 'REMAS (rekomendasi makan siang)',
    h1Closing: 'Closing Hour, Promises Next Hour, max 1 min',
    h1Times: { cross: '12:05', toh: '12:10', t1: '12:17', news1: '12:20', t2: '12:30', spot1: '12:32', t3: '12:40', news2a: '12:50', news2b: '12:52', close: '12:55' },
    h1Spot1Desc: 'Spot/Promo Program YA',
    h1Spot2Desc: 'Spot/Promo Program SMS',
    h1Songs: [
      'CHR manca (middle up)', 'CHR indo (middle up)', 'URBAN indo (middle)', 'URBAN manca (middle)',
      'CHR indo (middle)', 'CHR manca (middle)', 'URBAN manca (middle)', 'indie',
      'CHR manca (slow)', 'CHR manca (slow)', 'CHR indo (middle)', 'CHR (middle)',
    ],
    h2StartLabel: 'Jam Siar 2 (13.00 - 14.00)',
    h2EndTime: '13:05 - 14:00',
    h2Segmen: 'Segmen 2: Fakta Unik',
    h2SegmenSweeper: 'Fakta Unik',
    h2Talk1: 'Introduce Fakta Unik Segment',
    h2Talk2: 'Fakta Unik',
    h2Talk3: 'Fakta Unik',
    h2Closing: 'Closing Hour, Promises Next Hour, max 1 min',
    h2Times: { cross: '13:05', toh: '13:10', t1: '13:17', news1: '13:20', t2: '13:30', spot1: '13:32', t3: '13:40', news2a: '13:50', news2b: '13:52', close: '13:55' },
    h2Spot1Desc: 'Spot/Promo Program HK',
    h2Spot2Desc: 'Spot/Promo Program HI',
    h2Songs: [
      'URBAN manca (slow)', 'URBAN indo (middle)', 'URBAN indo (slow)', 'CHR manca (slow)',
      'CHR manca (slow)', 'URBAN indo (middle)', 'URBAN Indo (slow)', 'A/C Manca (Middle)',
      'A/C Indo (Slow)', 'URBAN manca (slow)', 'URBAN indo (slow)', 'Indie',
    ],
  }),

  'hi-flow': makeTwoHourFlowchart({
    id: 'hi-flow',
    sourceFile: 'FLOWCHART_2026__DAILY__b1858a82.pdf',
    headerTitle: "Hi Indonesia (Senin - Jum'at jam 14.00 - 16.00)",
    programShort: 'HI',
    vibesLagu: 'Medium / Cheerful Hits Song / indie / Nostalgic',
    reminders: ['Checklist Hour 1: IGStory', 'Checklist Hour 2: Twitter', 'Reminder akhir: Traffic'],
    hasNewsBlocks: true,
    h1StartLabel: 'Jam Siar 1 (14.00 - 15.00)',
    h1EndTime: '14:05 - 15:00',
    h1Segmen: 'Segmen 1: Tokoh Inspiratif Indonesia',
    h1SegmenSweeper: 'HI',
    h1Talk1: 'Spoiler Tokoh Inspiratif',
    h1Talk2: 'Tokoh Inspiratif',
    h1Talk3: 'Tokoh Inspiratif',
    h1Closing: 'Closing Hour, Promises Next Hour, max 1 min',
    h1Times: { cross: '14:05', toh: '14:10', t1: '14:17', news1: '14:20', t2: '14:30', t3: '14:40', news2a: '14:50', news2b: '14:52', close: '14:55' },
    h1Spot1Desc: 'Spot/Promo Program NEW',
    h1Spot2Desc: 'Spot/Promo Program MIZAN',
    h1Songs: [
      'A/C indo (middle)', 'URBAN indo (middle)', 'CHR indo (middle)', 'CHR indo (middle)',
      'A/C indo (slow)', 'CHR indo (slow)', 'Indie', 'Indie',
      'CHR indo (slow)', 'URBAN indo (slow)', 'CHR indo (slow)', 'A/C indo (slow)',
    ],
    h2StartLabel: 'Jam Siar 2 (15.00 - 16.00)',
    h2EndTime: '15:05 - 16:00',
    h2Segmen: 'Segmen 2: Seputar Indonesia',
    h2SegmenSweeper: 'HI',
    h2Talk1: 'Spoiler pembahasan',
    h2Talk2: 'Seputar Indonesia (tergantung tema)',
    h2Talk3: 'Seputar Indonesia (tergantung tema)',
    h2Closing: 'Closing Hour, Promises Next Hour, max 1 min',
    h2Times: { cross: '15:05', toh: '15:10', t1: '15:17', news1: '15:20', t2: '15:30', t3: '15:40', news2a: '15:50', news2b: '15:52', close: '15:55' },
    h2Spot1Desc: 'Spot/Promo Program FREELINE',
    h2Spot2Desc: 'Spot/Promo Program HK',
    h2Songs: [
      'CHR Indo (slow)', 'Indie', 'indie', 'URBAN indo (slow)',
      'CHR indo (slow)', 'CHR indo (slow)', 'A/C indo (slow)', 'indie',
      'CHR indo (slow)', 'indie', 'Religi', 'Religi',
    ],
  }),

  'mizan-flow': makeTwoHourFlowchart({
    id: 'mizan-flow',
    sourceFile: 'FLOWCHART_2026__DAILY__b1858a82.pdf',
    headerTitle: 'MIZAN (Senin - Minggu jam 16.00 - 18.00)',
    programShort: 'MIZAN',
    vibesLagu: 'Chill, Relax, Indie, Calm, Medium Beat',
    reminders: ['Checklist: IGStory, Twitter', '*cek jadwal Spot/Adlibs marketing (kalo gaada bebas)', 'Reminder akhir: Traffic'],
    hasNewsBlocks: true,
    h1StartLabel: 'Jam Siar 1 (16.00 - 17.00)',
    h1EndTime: '16:05 - 17:00',
    h1Segmen: 'Segmen 1: Motivasi (Islam)',
    h1SegmenSweeper: 'MIZAN',
    h1Talk1: 'Spoiler Motivasi',
    h1Talk2: 'Motivasi',
    h1Talk3: 'Motivasi',
    h1Closing: 'Closing Hour, Promises Next Hour, max 1 min',
    h1Times: { cross: '16:05', toh: '16:10', t1: '16:17', news1: '16:20', t2: '16:30', t3: '16:40', news2a: '16:50', news2b: '16:52', close: '16:55' },
    h1Spot1Desc: 'Spot/Promo Program',
    h1Spot2Desc: 'Spot/Promo Program',
    h1Songs: Array(12).fill('Religi'),
    h2StartLabel: 'Jam Siar 2 (17.00 - 18.00)',
    h2EndTime: '17:05 - 18:00',
    h2Segmen: 'Segmen 2: Tentang Keislaman / Tausiyah Ringan',
    h2SegmenSweeper: 'MIZAN',
    h2Talk1: 'Spoiler pembahasan',
    h2Talk2: 'Sesuai tema dari PO',
    h2Talk3: 'Sesuai tema dari PO',
    h2Closing: 'Closing Hour, Promises Next Hour, max 1 min',
    h2Times: { cross: '17:05', toh: '17:10', t1: '17:17', news1: '17:20', t2: '17:30', t3: '17:40', news2a: '17:50', news2b: '17:52', close: '17:55' },
    h2Spot1Desc: 'Spot/Promo Program',
    h2Spot2Desc: 'Spot/Promo Program',
    h2Songs: [
      'Religi', 'Religi', 'Religi', 'Religi',
      'Religi', 'Religi', 'Religi', 'Religi',
      'Religi', 'Religi', 'Indie/Arab Inggris (Rabu-Kamis)', 'CHR INDO (middle)/Arab Inggris (Rabu-Kamis)',
    ],
  }),

  'hk-flow': makeTwoHourFlowchart({
    id: 'hk-flow',
    sourceFile: 'FLOWCHART_2026__DAILY__b1858a82.pdf',
    headerTitle: 'Halo Kampus (Senin, Rabu & Jumat jam 18.00 - 20.00)',
    programShort: 'Halo Kampus',
    vibesLagu: 'Indie / Cheerfull / Calm / Medium Beat Hits Song',
    reminders: ['Checklist: IGStory', 'Segmen: Talkshow with BT or Ask Sobat Muda gabungan seputar kampus uinma', 'Reminder akhir: Traffic'],
    hasNewsBlocks: false,
    h1StartLabel: 'Jam Siar 1 (18.00 - 19.00)',
    h1EndTime: '18:05 - 19:00',
    h1Segmen: 'Segmen 1: Informasi seputar kampus UIN Malang',
    h1SegmenSweeper: 'HK',
    h1Talk1: 'Spoiler bahasan seputar Kampus',
    h1Talk2: 'Informasi seputar Kampus',
    h1Talk3: 'Informasi seputar Kampus',
    h1Closing: 'Closing Hour, Promises Next Hour, max 1 min',
    h1Times: { cross: '18:05', toh: '18:10', t1: '18:17', t2: '18:30', t3: '18:40', close: '18:55' },
    h1Spot1Desc: 'Spot/Promo Program',
    h1Spot2Desc: 'Spot/Promo Program',
    h1Songs: [
      'CHR manca (middle)', 'CHR indo (middle)', 'URBAN indo (middle)', 'A/C manca (middle up)',
      'indie (middle)', 'indie (middle)', 'URBAN manca (middle up)', 'CHR indo (middle up)',
      'CHR manca (middle up)', 'CHR manca (middle up)', 'indie (middle)',
      'indie (middle up)', 'CHR manca (middle up)', 'URBAN manca (middle)',
    ],
    h2StartLabel: 'Jam Siar 2 (19.00 - 20.00)',
    h2EndTime: '19:05 - 20:00',
    h2Segmen: 'Segmen 2: Informasi seputar kampus UIN Malang',
    h2SegmenSweeper: 'HK',
    h2Talk1: 'Spoiler informasi seputar kampus lagi',
    h2Talk2: 'Informasi seputar Kampus',
    h2Talk3: 'Informasi seputar Kampus',
    h2Closing: 'Closing Hour, Promises Next Hour, max 1 min',
    h2Times: { cross: '19:05', toh: '19:10', t1: '19:17', t2: '19:30', t3: '19:40', close: '19:55' },
    h2Spot1Desc: 'Spot/Promo Program',
    h2Spot2Desc: 'Spot/Promo Program',
    h2Songs: [
      'indie (middle up)', 'CHR manca (middle up)', 'CHR indo (middle)', 'CHR manca (middle)',
      'URBAN indo (middle up)', 'A/C manca (middle up)', 'A/C indo (middle up)', 'CHR manca (middle up)',
      'indie (middle up)', 'URBAN indo (up beat)', 'URBAN manca (up beat)',
      'CHR indo (up beat)', 'CHR manca (up beat)', 'Korea',
    ],
  }),

  // SHARED FLOWCHART FOR ENGLISH DAY & YAUMUL ARABI (verified in Page 7 of Daily Flowchart PDF)
  'ed-ya-shared': makeTwoHourFlowchart({
    id: 'ed-ya-shared',
    sourceFile: 'FLOWCHART_2026__DAILY__b1858a82.pdf',
    headerTitle: 'English Day / Yaumul Araby (ED Tuesday; YA Thursday, 18.00 - 20.00)',
    programShort: 'ED/YA',
    vibesLagu: 'Low Beat / Mellow / Calm / Medium Beat Hits Song',
    reminders: ['Checklist: IGStory, Twitter', 'Reminder akhir: Traffic'],
    hasNewsBlocks: false,
    h1StartLabel: 'Jam Siar 1 (18.00 - 19.00)',
    h1EndTime: '18:05 - 19:00',
    h1Segmen: 'Segmen 1: Hal yang lagi trend atau dunia pendidikan',
    h1SegmenSweeper: 'ED/YA',
    h1Talk1: 'Spoiler Pembahasan',
    h1Talk2: 'Pembahasan',
    h1Talk3: 'Pembahasan',
    h1Closing: 'Closing Hour, Promises Next Hour, max 1 min',
    h1Times: { cross: '18:05', toh: '18:10', t1: '18:17', t2: '18:30', spot1: '18:32', t3: '18:40', close: '18:55' },
    h1Spot1Desc: 'Spot/Promo Program NEW',
    h1Spot2Desc: 'Spot/Promo Program MIZAN',
    h1Songs: Array(13).fill('Inggris/Arab'),
    h2StartLabel: 'Jam Siar 2 (19.00 - 20.00)',
    h2EndTime: '19:05 - 20:00',
    h2Segmen: 'Segmen 2: Hal yang lagi trend atau dunia pendidikan',
    h2SegmenSweeper: 'ED/YA',
    h2Talk1: 'Spoiler pembahasan',
    h2Talk2: 'Pembahasan',
    h2Talk3: 'Pembahasan',
    h2Closing: 'Closing Hour, Promises Next Hour, max 1 min',
    h2Times: { cross: '19:05', toh: '19:10', t1: '19:17', t2: '19:30', spot1: '19:32', t3: '19:40', close: '19:55' },
    h2Spot1Desc: 'Spot/Promo Program FREELINE',
    h2Spot2Desc: 'Spot/Promo Program Love Cast',
    h2Songs: [
      'Inggris/Arab', 'Inggris/Arab', 'Inggris/Arab', 'Inggris/Arab',
      'Inggris/Arab', 'Inggris/Arab', 'Inggris/Arab', 'Inggris/Arab',
      'Inggris/Arab', 'Inggris/Arab', 'Inggris/Arab', 'Inggris/Arab',
      'Inggris/Arab', 'Recurrent Manca', 'Recurrent Indo',
    ],
  }),

  'freeline-flow': makeTwoHourFlowchart({
    id: 'freeline-flow',
    sourceFile: 'FLOWCHART_2026__DAILY__b1858a82.pdf',
    headerTitle: "Freeline (Senin - Jum'at jam 20.00 - 22.00)",
    programShort: 'FREELINE',
    vibesLagu: 'Up Beat / Low Beat / Mellow / Calm / Medium Beat Hits Song',
    reminders: ['Checklist Hour 1: IGStory, Twitter', 'Checklist Hour 2: Twitter', '*cek jadwal Spot/Adlibs marketing (kalo gaada bebas)', 'Aturan Script: 1 Penyiar (Non-Tandem)'],
    hasNewsBlocks: false,
    h1StartLabel: 'Jam Siar 1 (20.00 - 21.00)',
    h1EndTime: '20:05 - 21:00',
    h1Segmen: 'Segmen 1: SELAM (Absen Malam)',
    h1SegmenSweeper: 'SELAM',
    h1Talk1: 'ajakin gabungan SELAM (absen malam)',
    h1Talk2: 'bacain gabungan',
    h1Talk3: 'bacain gabungan',
    h1Closing: 'Closing Hour, Promises Next Hour, max 1 min',
    h1Times: { cross: '20:05', toh: '20:10', t1: '20:17', t2: '20:30', spot1: '20:32', t3: '20:40', close: '20:55' },
    h1Spot1Desc: 'Spot/Promo Program SMS',
    h1Spot2Desc: 'Spot/Promo Program NEW',
    h1Songs: [
      'CHR Manca (Up Beat)', 'URBAN Indo (Up beat)', 'URBAN Indo (Up Beat)', 'URBAN Manca (Up Beat)',
      'CHR Indo (Up Beat)', 'URBAN MANCA (Middle Up)', 'URBAN INDO (Middle Up)', 'CHR Indo (Up Beat)',
      'CHR Manca (Up Beat)', 'URBAN Indo (Middle Up)', 'URBAN Manca (Up beat)',
      'CHR Indo (Middle Up)', 'A/C Manca (Middle Up)', 'URBAN Indo (Middle)',
    ],
    h2StartLabel: 'Jam Siar 2 (21.00 - 22.00)',
    h2EndTime: '21:05 - 22:00',
    h2Segmen: 'Segmen 2: This or That',
    h2SegmenSweeper: 'This or That',
    h2Talk1: 'Ask Sobat Muda to Join This or That',
    h2Talk2: 'Bacain gabungan Sobat Muda yang join',
    h2Talk3: 'Bacain gabungan Sobat Muda yang join',
    h2Closing: 'Closing Hour, Promises Next Hour, max 1 min',
    h2Times: { cross: '21:05', toh: '21:10', t1: '21:17', t2: '21:30', t3: '21:40', close: '21:55' },
    h2Spot1Desc: 'Spot/Promo Program SWS',
    h2Spot2Desc: 'Spot/Promo Program Freetime',
    h2Songs: [
      'URBAN Indo (Middle)', 'CHR Manca (Middle)', 'CHR Indo (Middle)', 'CHR Manca (Middle)',
      'URBAN Manca (Middle)', 'CHR Manca (Middle)', 'A/C Indo (Middle)', 'URBAN Indo (Middle Up)',
      'A/C Manca (Middle Up)', 'CHR Indo (Middle)', 'URBAN Manca (Middle)',
      'URBAN Indo (Slow)', 'A/C Manca (Slow)', 'URBAN Indo (Slow)',
    ],
  }),

  // WEEKEND PROGRAMS
  'sws-flow': SWS_FLOWCHART,

  'top-chart-flow': makeTwoHourFlowchart({
    id: 'top-chart-flow',
    sourceFile: 'FLOWCHART_2026__WEEKEND__5aafd235.pdf',
    headerTitle: 'TOP CHART (SAT 12.00 - 14.00 WIB)',
    programShort: 'Top Chart',
    vibesLagu: 'Chill, Relax, Indie, Calm, Medium Beat, slow',
    reminders: ['Membahas tangga lagu HITS di SIMFONI (Peringkat 10 sampai 1)'],
    hasNewsBlocks: false,
    h1StartLabel: 'Jam Siar 1 (12.00 - 13.00)',
    h1EndTime: '12:05 - 13:00',
    h1Segmen: 'Tangga Lagu HITS (10 s.d. 5)',
    h1SegmenSweeper: 'Top Chart',
    h1Talk1: 'Spoiler Top Chart',
    h1Talk2: 'Bahas Top Chart 10, 9',
    h1Talk3: 'Bahas Top Chart 8, 7',
    h1Closing: 'Bahas Top Chart 6, 5 & Closing Hour, Promises Next Hour, max 1 min',
    h1Times: { cross: '12:05', toh: '12:10', t1: '12:17', t2: '12:30', t3: '12:40', close: '12:55' },
    h1Spot1Desc: 'Spot/Promo Program ED',
    h1Spot2Desc: 'Spot/Promo Program',
    h1Songs: [
      'Manca', 'Indo', 'Indo', 'Manca', 'Indo',
      'Indo', 'Manca', 'Indo', 'Manca', 'Korea',
      'Manca', 'Indo', 'Indo', 'Manca', 'Indo',
    ],
    h2StartLabel: 'Jam Siar 2 (13.00 - 14.00)',
    h2EndTime: '13:05 - 14:00',
    h2Segmen: 'Tangga Lagu HITS (4 s.d. 1)',
    h2SegmenSweeper: 'Top Chart',
    h2Talk1: 'Bahas Top Chart 4, 3',
    h2Talk2: 'Bahas Top Chart 2',
    h2Talk3: 'Bahas Top Chart 1',
    h2Closing: 'Closing Hour, Promises Next Hour, max 1 min',
    h2Times: { cross: '13:05', toh: '13:10', t1: '13:17', t2: '13:30', t3: '13:40', close: '13:55' },
    h2Spot1Desc: 'Spot/Promo Program Mixer',
    h2Spot2Desc: 'Spot/Promo Program',
    h2Songs: [
      'Indo', 'Manca', 'Indo', 'Manca', 'Korea',
      'Manca', 'Indo', 'Indo', 'Manca', 'Indo',
      'Indo', 'Manca', 'Indo', 'Manca', 'Korea',
    ],
  }),

  'daebak-flow': makeTwoHourFlowchart({
    id: 'daebak-flow',
    sourceFile: 'FLOWCHART_2026__WEEKEND__5aafd235.pdf',
    headerTitle: 'DAEBAK (SAT 14.00 - 16.00 WIB) — Dengerin Bareng Musik K-Pop',
    programShort: 'Daebak',
    vibesLagu: 'Up Beat / Power Up / Cheerful Hits Song / Middle Beat Song / Calm',
    reminders: ['Terdapat Break Shortly Deeplydoo di setiap segmen musik'],
    hasNewsBlocks: false,
    hasShortlyDeeplydoo: true,
    h1StartLabel: 'Jam Siar 1 (14.00 - 15.00)',
    h1EndTime: '14:05 - 15:00',
    h1Segmen: 'Segmen 1: Seputar K-pop idol atau musik Korea',
    h1SegmenSweeper: 'Daebak',
    h1Talk1: 'Spoiler topik',
    h1Talk2: 'Pembahasan seputar K-pop idol, ataupun musik',
    h1Talk3: 'Pembahasan seputar K-pop idol, ataupun musik',
    h1Closing: 'Closing Hour, Promises Next Hour, max 1 min',
    h1Times: { cross: '14:05', toh: '14:10', t1: '14:17', t2: '14:30', t3: '14:40', close: '14:55' },
    h1Spot1Desc: 'Spot/Promo Program SMS',
    h1Spot2Desc: 'Spot/Promo Program New',
    h1Songs: Array(15).fill('Korea'),
    h2StartLabel: 'Jam Siar 2 (15.00 - 16.00)',
    h2EndTime: '15:05 - 16:00',
    h2Segmen: 'Segmen 2: Film, aktor/aktris, drama Korea',
    h2SegmenSweeper: 'Daebak',
    h2Talk1: 'Spoiler topik',
    h2Talk2: 'Pembahasan seputar dunia film, aktor/aktris, drama, dsb',
    h2Talk3: 'Pembahasan seputar dunia film, aktor/aktris, drama, dsb',
    h2Closing: 'Closing Hour, Promises Next Hour, max 1 min',
    h2Times: { cross: '15:05', toh: '15:10', t1: '15:17', t2: '15:30', t3: '15:40', close: '15:55' },
    h2Spot1Desc: 'Spot/Promo Program Top Chart',
    h2Spot2Desc: 'Spot/Promo Program Freetime',
    h2Songs: [...Array(13).fill('Korea'), 'Manca', 'Indo'],
  }),

  'lovecast-flow': makeTwoHourFlowchart({
    id: 'lovecast-flow',
    sourceFile: 'FLOWCHART_2026__WEEKEND__5aafd235.pdf',
    headerTitle: 'LOVECAST (Sat, 18.00 - 20:00) — Love Story n Chill Broadcast',
    programShort: 'Lovecast',
    vibesLagu: 'Up Beat / Low Beat / Mellow / Calm / Medium Beat Hits Song',
    reminders: ['Segmen 1 (Flowchart): 18.00 - 19.00 (SELAM)', 'Segmen 2 (Flowchart): 19.00 - 20.00 (This or That)', 'Terdapat Break Shortly Deeplydoo'],
    hasNewsBlocks: false,
    hasShortlyDeeplydoo: true,
    h1StartLabel: 'Jam Siar 1 (18.00 - 19.00)',
    h1EndTime: '18:05 - 19:00',
    h1Segmen: 'Segmen 1 (Flowchart): SELAM',
    h1SegmenSweeper: 'SELAM',
    h1Talk1: 'Ajakin SELAM',
    h1Talk2: 'Bacain gabungan SELAM',
    h1Talk3: 'Bacain gabungan SELAM',
    h1Closing: 'Closing Hour, Promises Next Hour, max 1 min',
    h1Times: { cross: '18:05', toh: '18:10', t1: '18:17', t2: '18:30', spot1: '18:32', t3: '18:40', close: '18:55' },
    h1Spot1Desc: 'Spot/Promo Program ED',
    h1Spot2Desc: 'Spot/Promo Program RNR',
    h1Songs: [
      'Manca', 'Indo', 'Indo', 'Manca', 'Indo',
      'Indo', 'Manca', 'Indo', 'Manca', 'Korea',
      'Manca', 'Indo', 'Indo', 'Manca', 'Indo',
    ],
    h2StartLabel: 'Jam Siar 2 (19.00 - 20.00)',
    h2EndTime: '19:05 - 20:00',
    h2Segmen: 'Segmen 2 (Flowchart): This or That',
    h2SegmenSweeper: 'This or That',
    h2Talk1: 'Ajakin gabungan',
    h2Talk2: 'bacain gabungan',
    h2Talk3: 'bacain gabungan',
    h2Closing: 'Closing Hour, Promises Next Hour, max 1 min',
    h2Times: { cross: '19:05', toh: '19:10', t1: '19:17', t2: '19:30', spot1: '19:32', t3: '19:40', close: '19:55' },
    h2Spot1Desc: 'Spot/Promo Program SWS',
    h2Spot2Desc: 'Spot/Promo Program YA',
    h2Songs: [
      'Indo', 'Manca', 'Indo', 'Manca', 'Korea',
      'Manca', 'Indo', 'Indo', 'Manca', 'Indo',
      'Indo', 'Manca', 'Indo', 'Manca', 'Korea',
    ],
    verificationNotes: [
      'Perbedaan isi segmen: Panduan menulis Segmen 1 bahas istilah percintaan & Segmen 2 curhat bareng sobat muda, sedangkan Flowchart Weekend tertulis SELAM & This or That.',
    ],
  }),

  'sport-flow': makeTwoHourFlowchart({
    id: 'sport-flow',
    sourceFile: 'FLOWCHART_2026__WEEKEND__5aafd235.pdf',
    headerTitle: 'SIMFONI SPORT (Sunday, 12:00 - 14:00)',
    programShort: 'Simfoni Sport',
    vibesLagu: 'Up Beat / Power Up / Cheerful Hits Song / Middle Beat Song',
    reminders: ['Bahas seputar Olahraga & talkshow bersama komunitas pecinta bola'],
    hasNewsBlocks: false,
    h1StartLabel: 'Jam Siar 1 (12.00 - 13.00)',
    h1EndTime: '12:05 - 13:00',
    h1Segmen: 'Segmen 1: Pembahasan Olahraga',
    h1SegmenSweeper: 'Simfoni Sport',
    h1Talk1: 'Spoiler topik',
    h1Talk2: 'Bahas Olahraga',
    h1Talk3: 'Bahas Olahraga',
    h1Closing: 'Closing Hour, Promises Next Hour, max 1 min',
    h1Times: { cross: '12:05', toh: '12:10', t1: '12:17', t2: '12:30', spot1: '12:32', t3: '12:40', close: '12:55' },
    h1Spot1Desc: 'Spot/Promo Program YA',
    h1Spot2Desc: 'Spot/Promo Program Fresh Sunday',
    h1Songs: [
      'Manca', 'Indo', 'Indo', 'Manca', 'Indo',
      'Indo', 'Manca', 'Indo', 'Manca', 'Korea',
      'Manca', 'Indo', 'Indo', 'Manca', 'Indo',
    ],
    h2StartLabel: 'Jam Siar 2 (13.00 - 14.00)',
    h2EndTime: '13:05 - 14:00',
    h2Segmen: 'Segmen 2: Pembahasan Olahraga & Komunitas',
    h2SegmenSweeper: 'Simfoni Sport',
    h2Talk1: 'Spoiler topik',
    h2Talk2: 'Bahas Olahraga',
    h2Talk3: 'Bahas Olahraga',
    h2Closing: 'Closing Hour, Promises Next Hour, max 1 min',
    h2Times: { cross: '13:05', toh: '13:10', t1: '13:17', t2: '13:30', t3: '13:40', close: '13:55' },
    h2Spot1Desc: 'Spot/Promo Program Fresh Sunday',
    h2Spot2Desc: 'Spot/Promo Program Freeline Weekend',
    h2Songs: [
      'Indo', 'Manca', 'Indo', 'Manca', 'Korea',
      'Manca', 'Indo', 'Indo', 'Manca', 'Indo',
      'Indo', 'Manca', 'Indo', 'Manca', 'Korea',
    ],
  }),

  'fresh-sunday-flow': makeTwoHourFlowchart({
    id: 'fresh-sunday-flow',
    sourceFile: 'FLOWCHART_2026__WEEKEND__5aafd235.pdf',
    headerTitle: 'FRESH SUNDAY (SUN 14.00 - 16.00 WIB)',
    programShort: 'Fresh Sunday',
    vibesLagu: 'Medium / Cheerful Hits Song / indie / New Song / Calm',
    reminders: ['Bahas seputar lagu baru indo, manca, korea pada minggu itu', '*wajib didampingi MO'],
    hasNewsBlocks: false,
    h1StartLabel: 'Jam Siar 1 (14.00 - 15.00)',
    h1EndTime: '14:05 - 15:00',
    h1Segmen: 'Fresh Sunday Countdown (7 s.d. 4)',
    h1SegmenSweeper: 'Fresh Sunday',
    h1Talk1: 'Spoiler topik',
    h1Talk2: 'Bahas fresh sunday 7, 6',
    h1Talk3: 'Bahas fresh sunday 5, 4',
    h1Closing: 'Closing Hour, Promises Next Hour, max 1 min',
    h1Times: { cross: '14:05', toh: '14:10', t1: '14:17', t2: '14:30', t3: '14:40', close: '14:55' },
    h1Spot1Desc: 'Spot/Promo Program Freeline Weekend',
    h1Spot2Desc: 'Spot/Promo Program Daebak',
    h1Songs: [
      'Manca', 'Indo', 'Indo', 'Manca', 'Indo',
      'Indo', 'Manca', 'Indo', 'Manca', 'Korea',
      'Manca', 'Indo', 'Indo', 'Manca', 'Indo',
    ],
    h2StartLabel: 'Jam Siar 2 (15.00 - 16.00)',
    h2EndTime: '15:05 - 16:00',
    h2Segmen: 'Fresh Sunday Countdown (3 s.d. 1)',
    h2SegmenSweeper: 'Fresh Sunday',
    h2Talk1: 'Spoiler topik',
    h2Talk2: 'Bahas fresh sunday 3, 2',
    h2Talk3: 'Bahas fresh sunday 1',
    h2Closing: 'Closing Hour, Promises Next Hour, max 1 min',
    h2Times: { cross: '15:05', toh: '15:10', t1: '15:17', t2: '15:30', t3: '15:40', close: '15:55' },
    h2Spot1Desc: 'Spot/Promo Program Freetime',
    h2Spot2Desc: 'Spot/Promo Program HI',
    h2Songs: [
      'Indo', 'Manca', 'Indo', 'Manca', 'Korea',
      'Manca', 'Indo', 'Indo', 'Manca', 'Indo',
      'Indo', 'Manca', 'Indo', 'Manca', 'Korea',
    ],
  }),

  'soda-flow': makeTwoHourFlowchart({
    id: 'soda-flow',
    sourceFile: 'FLOWCHART_2026__WEEKEND__5aafd235.pdf',
    headerTitle: 'SODA (Sun, 18:00 - 20:00) — Siaran Bareng Sobat Muda',
    programShort: 'SODA',
    vibesLagu: 'Indie / Cheerfull / Calm / Medium Beat Hits Song',
    reminders: ['Bahas info komunitas di luar kampus UIN Malang', 'Terdapat Break Shortly Deeplydoo'],
    hasNewsBlocks: false,
    hasShortlyDeeplydoo: true,
    h1StartLabel: 'Jam Siar 1 (18.00 - 19.00)',
    h1EndTime: '18:05 - 19:00',
    h1Segmen: 'Segmen 1: Pembahasan Info Komunitas',
    h1SegmenSweeper: 'SODA',
    h1Talk1: 'Spoiler Topik',
    h1Talk2: 'Pembahasan isi',
    h1Talk3: 'Pembahasan isi',
    h1Closing: 'Closing Hour, Promises Next Hour, max 1 min',
    h1Times: { cross: '18:05', toh: '18:10', t1: '18:17', t2: '18:30', t3: '18:40', close: '18:55' },
    h1Spot1Desc: 'Spot/Promo Program YA',
    h1Spot2Desc: 'Spot/Promo Program SMS',
    h1Songs: [
      'Manca', 'Indo', 'Indo', 'Manca', 'Indo',
      'Indo', 'Manca', 'Indo', 'Manca', 'Korea',
      'Manca', 'Indo', 'Indo', 'Manca', 'Indo',
    ],
    h2StartLabel: 'Jam Siar 2 (19.00 - 20.00)',
    h2EndTime: '19:05 - 20:00',
    h2Segmen: 'Segmen 2: Pembahasan Info Komunitas',
    h2SegmenSweeper: 'SODA',
    h2Talk1: 'Spoiler Topik',
    h2Talk2: 'Pembahasan isi',
    h2Talk3: 'Pembahasan isi',
    h2Closing: 'Closing Hour, Promises Next Hour, max 1 min',
    h2Times: { cross: '19:05', toh: '19:10', t1: '19:17', t2: '19:30', spot1: '19:32', t3: '19:40', close: '19:55' },
    h2Spot1Desc: 'Spot/Promo Program Top Chart',
    h2Spot2Desc: 'Spot/Promo Program SWS',
    h2Songs: [
      'Indo', 'Manca', 'Indo', 'Manca', 'Korea',
      'Manca', 'Indo', 'Indo', 'Manca', 'Indo',
      'Indo', 'Manca', 'Indo', 'Manca', 'Korea',
    ],
    verificationNotes: [
      'Perbedaan jam siar: Panduan menulis Minggu 14.00–16.00, sedangkan Flowchart Weekend menulis Minggu 18:00–20:00.',
    ],
  }),

  // RAMADAN PROGRAMS
  'sosmed-flow': makeTwoHourFlowchart({
    id: 'sosmed-flow',
    sourceFile: 'FLOWCHART_2026__MarhabanYaRamadhan.xlsx_2eb9c056.pdf',
    headerTitle: 'SOSMED (03.00 - 05.00 WIB) — Sahur Seru Bareng Sobat Muda (SPECIAL RAMADHAN)',
    programShort: 'SOSMED',
    vibesLagu: 'Chill, Relax, Indie, Calm, Medium Beat, slow',
    reminders: ['Segmen 1 = req lagu', 'Segmen 2 = Gabungan sama sobat muda (via telfon / gmeet)'],
    hasNewsBlocks: false,
    h1StartLabel: 'Jam Siar 1 (Tertulis 2:05 - 2:55 di tabel)',
    h1EndTime: 'Jam 1',
    h1Segmen: 'Segmen 1: Request Lagu & Menyapa',
    h1SegmenSweeper: 'SOSMED',
    h1Talk1: 'Spoiler topik',
    h1Talk2: 'Pembahasan isi',
    h1Talk3: 'Pembahasan isi',
    h1Closing: 'Closing Hour, Promises Next Hour',
    h1Times: { cross: '2:05', toh: '2:10', t1: '2:17', t2: '2:30', t3: '2:40', close: '2:55' },
    h1Spot1Desc: 'Spot/Promo Program IFTAR',
    h1Spot2Desc: 'Spot/Promo Program New',
    h1Songs: [
      'Manca', 'Indo', 'Indo', 'Manca', 'Indo',
      'Indo', 'Manca', 'Indo', 'Manca', 'Korea',
      'Manca', 'Indo', 'Indo', 'Manca', 'Indo',
    ],
    h2StartLabel: 'Jam Siar 2 (Tertulis 3:05 - 3:55 di tabel)',
    h2EndTime: 'Jam 2',
    h2Segmen: 'Segmen 2: Gabungan (Telepon / GMeet)',
    h2SegmenSweeper: 'SOSMED',
    h2Talk1: 'Spoiler topik',
    h2Talk2: 'Pembahasan isi',
    h2Talk3: 'Pembahasan isi',
    h2Closing: 'Closing Hour, Promises Next Hour, max 1 min',
    h2Times: { cross: '3:05', toh: '3:10', t1: '3:17', t2: '3:30', t3: '3:40', close: '3:55' },
    h2Spot1Desc: 'Spot/Promo Program KURMA',
    h2Spot2Desc: 'Spot/Promo Program New',
    h2Songs: [
      'Indo', 'Manca', 'Indo', 'Manca', 'Korea',
      'Manca', 'Indo', 'Indo', 'Manca', 'Indo',
      'Indo', 'Manca', 'Indo', 'Manca', 'Korea',
    ],
    verificationNotes: [
      'Judul tertulis 03.00–05.00 WIB dan Panduan menyebut Sabtu & Minggu 03.00–05.00, namun kolom Time pada tabel tertulis 2:05–3:55 serta deskripsi TOH/Sweeper masih tertulis "Susu Soda".',
    ],
  }),

  'iftar-flow': makeTwoHourFlowchart({
    id: 'iftar-flow',
    sourceFile: 'FLOWCHART_2026__MarhabanYaRamadhan.xlsx_2eb9c056.pdf',
    headerTitle: 'IFTAR (Senin - Minggu jam 16.00 - 18.00) — SPECIAL RAMADHAN',
    programShort: 'MIZAN (Template IFTAR)',
    vibesLagu: 'Chill, Relax, Indie, Calm, Medium Beat · Playlist: Full Lagu Religi',
    reminders: [
      'Seg 1 = Es Serut (Muslim Zaman Now) Tentang Motivasi',
      'Segmen 2 = Rekomendasi Ngabuburit (Tempat & makanan buat buka puasa / gabungan dari sobat muda)',
    ],
    hasNewsBlocks: true,
    h1StartLabel: 'Jam Siar 1 (16.00 - 17.00)',
    h1EndTime: '16:05 - 17:00',
    h1Segmen: 'Segmen 1: Es Serut (Motivasi)',
    h1SegmenSweeper: 'MIZAN (Template IFTAR)',
    h1Talk1: 'Spoiler Motivasi',
    h1Talk2: 'Motivasi',
    h1Talk3: 'Motivasi',
    h1Closing: 'Closing Hour, Promises Next Hour, max 1 min',
    h1Times: { cross: '16:05', toh: '16:10', t1: '16:17', news1: '16:20', t2: '16:30', t3: '16:40', news2a: '16:50', news2b: '16:52', close: '16:55' },
    h1Spot1Desc: 'Spot/Promo Program',
    h1Spot2Desc: 'Spot/Promo Program',
    h1Songs: Array(12).fill('Religi'),
    h2StartLabel: 'Jam Siar 2 (17.00 - 18.00)',
    h2EndTime: '17:05 - 18:00',
    h2Segmen: 'Segmen 2: Rekomendasi Ngabuburit',
    h2SegmenSweeper: 'MIZAN (Template IFTAR)',
    h2Talk1: 'Spoiler pembahasan',
    h2Talk2: 'Sesuai tema dari PO',
    h2Talk3: 'Sesuai tema dari PO',
    h2Closing: 'Closing Hour, Promises Next Hour, max 1 min',
    h2Times: { cross: '17:05', toh: '17:10', t1: '17:17', news1: '17:20', t2: '17:30', t3: '17:40', news2a: '17:50', news2b: '17:52', close: '17:55' },
    h2Spot1Desc: 'Spot/Promo Program',
    h2Spot2Desc: 'Spot/Promo Program',
    h2Songs: [
      'Religi', 'Religi', 'Religi', 'Religi',
      'Religi', 'Religi', 'Religi', 'Religi',
      'Religi', 'Religi', 'Indie/Arab Inggris (Rabu-Kamis)', 'New release indo (middle)/Arab Inggris (Rabu-Kamis)',
    ],
    verificationNotes: [
      'Pada file Flowchart Ramadhan, beberapa label slot (Cross Promo, TOH, Sweeper) masih bertuliskan MIZAN dari template dasar.',
    ],
  }),

  'kurma-flow': makeTwoHourFlowchart({
    id: 'kurma-flow',
    sourceFile: 'FLOWCHART_2026__MarhabanYaRamadhan.xlsx_2eb9c056.pdf',
    headerTitle: 'KURMA (21.00 - 23.00 WIB) — Kumpulan Cerita Ramadhan (SPECIAL RAMADHAN)',
    programShort: 'FREELINE (Template KURMA)',
    vibesLagu: 'Up Beat / Low Beat / Mellow / Calm / Medium Beat Hits Song',
    reminders: [
      'Seg 1 = Semarak Ramadhan di Nusantara dan Belahan Dunia (Ngomongin Tradisi Ramadhan di Indonesia)',
      'Seg 2 = Freeline This or That / SELAM (Panduan: interaksi langsung via telpon)',
    ],
    hasNewsBlocks: false,
    h1StartLabel: 'Jam Siar 1 (Tertulis 20:05 - 20:55 di tabel)',
    h1EndTime: 'Jam 1',
    h1Segmen: 'Segmen 1: Semarak Ramadhan / Tradisi Ramadhan',
    h1SegmenSweeper: 'SELAM (Template KURMA)',
    h1Talk1: 'ajakin gabungan SELAM (absen malam)',
    h1Talk2: 'bacain gabungan',
    h1Talk3: 'bacain gabungan',
    h1Closing: 'Closing Hour, Promises Next Hour, max 1 min',
    h1Times: { cross: '20:05', toh: '20:10', t1: '20:17', t2: '20:30', spot1: '20:32', t3: '20:40', close: '20:55' },
    h1Spot1Desc: 'Spot/Promo Program SMS',
    h1Spot2Desc: 'Spot/Promo Program NEW',
    h1Songs: [
      'CHR Manca (Up Beat)', 'CHR Indo (Up beat)', 'CHR Indo (Up Beat)', 'CHR Manca (Up Beat)',
      'CHR Indo (Up Beat)', 'CHR Indo (Middle Up)', 'CHR Manca (Middle Up)', 'CHR Indo (Up Beat)',
      'CHR Manca (Up Beat)', 'URBAN Indo (Middle Up)', 'URBAN Manca (Up beat)',
      'CHR Indo (Middle Up)', 'A/C Manca (Middle Up)', 'URBAN Indo (Middle)',
    ],
    h2StartLabel: 'Jam Siar 2 (Tertulis 21:05 - 21:55 di tabel)',
    h2EndTime: 'Jam 2',
    h2Segmen: 'Segmen 2: Freeline This or That / SELAM',
    h2SegmenSweeper: 'This or That (Template KURMA)',
    h2Talk1: 'Ask Sobat Muda to Join This or That',
    h2Talk2: 'Bacain gabungan Sobat Muda yang join',
    h2Talk3: 'Bacain gabungan Sobat Muda yang join',
    h2Closing: 'Closing Hour, Promises Next Hour, max 1 min',
    h2Times: { cross: '21:05', toh: '21:10', t1: '21:17', t2: '21:30', t3: '21:40', close: '21:55' },
    h2Spot1Desc: 'Spot/Promo Program SWS',
    h2Spot2Desc: 'Spot/Promo Program Freetime',
    h2Songs: [
      'URBAN Indo (Middle)', 'CHR Manca (Middle)', 'CHR Indo (Middle)', 'CHR Manca (Middle)',
      'URBAN Manca (Middle)', 'CHR Manca (Middle)', 'A/C Indo (Middle)', 'CHR Indo (Middle Up)',
      'A/C Manca (Middle Up)', 'CHR Indo (Middle)', 'URBAN Manca (Middle)',
      'URBAN Indo (Slow)', 'A/C Manca (Slow)', 'URBAN Indo (Slow)',
    ],
    verificationNotes: [
      'Judul & Panduan menulis jam 21.00–23.00 WIB, namun kolom Time pada tabel tertulis 20:05–21:55 dan label slot sebagian masih bertuliskan FREELINE.',
    ],
  }),
};

export const OFFICIAL_PROGRAMS: RadioProgram[] = [
  // A. Daily & Weekly Programs
  {
    id: 'simfoni-morning-show',
    code: 'SMS',
    name: 'Simfoni Morning Show (SMS)',
    category: 'Daily & Weekly Programs',
    scheduleDay: "Senin - Jum'at",
    scheduleTime: '08.00 - 10.00',
    segmentsSummary: ['Segmen 1: WEKER (Kirim salam & request lagu)', 'Segmen 2: Yay or Nay'],
    summary:
      'Program pagi penyemangat Crew SIMFONI untuk menemani aktivitas pagi Sobat Siar dengan segmen WEKER dan Yay or Nay.',
    flowchartId: 'sms-flow',
  },
  {
    id: 'freetime',
    code: 'FT',
    name: 'Freetime (FT)',
    category: 'Daily & Weekly Programs',
    scheduleDay: "Senin - Jum'at",
    scheduleTime: '10.00 - 12.00',
    segmentsSummary: ['Segmen 1: Tips n Trick (TnT)', 'Segmen 2: RELA (Rekomendasi Lagu)'],
    summary:
      'Program menjelang siang berisi tips n trick bermanfaat dan adu rekomendasi lagu seru.',
    flowchartId: 'freetime-flow',
  },
  {
    id: 'rest-n-relax',
    code: 'RNR',
    name: 'Rest n Relax (RNR)',
    category: 'Daily & Weekly Programs',
    scheduleDay: "Senin - Jum'at",
    scheduleTime: '12.00 - 14.00',
    segmentsSummary: ['Segmen 1: REMAS (Rekomendasi Makan Siang / Ramadhan: Fakta Unik)', 'Segmen 2: Fakta Unik'],
    summary:
      'Program istirahat siang bernuansa santai dengan rekomendasi makan siang dan fakta-fakta unik.',
    flowchartId: 'rnr-flow',
  },
  {
    id: 'hi-indonesia',
    code: 'HI',
    name: 'Hi Indonesia (HI)',
    category: 'Daily & Weekly Programs',
    scheduleDay: "Senin - Jum'at",
    scheduleTime: '14.00 - 16.00',
    segmentsSummary: ['Segmen 1: Tokoh Inspiratif Indonesia', 'Segmen 2: Seputar Indonesia'],
    summary:
      'Program sore yang mengangkat kisah tokoh inspiratif Tanah Air dan kabar seputar Indonesia.',
    flowchartId: 'hi-flow',
  },
  {
    id: 'muslim-zaman-now',
    code: 'Mizan',
    name: 'Muslim Zaman Now (Mizan)',
    category: 'Daily & Weekly Programs',
    scheduleDay: 'Setiap Hari (Senin - Minggu)',
    scheduleTime: '16.00 - 18.00',
    segmentsSummary: ['Segmen 1: Motivasi Islam', 'Segmen 2: Tausiyah Ringan / Tentang Keislaman'],
    summary:
      'Program religi harian penuh motivasi Islam, tausiyah ringan, dan playlist lagu religi.',
    flowchartId: 'mizan-flow',
  },
  {
    id: 'halo-kampus',
    code: 'HK',
    name: 'Halo Kampus (HK)',
    category: 'Daily & Weekly Programs',
    scheduleDay: "Senin, Rabu, Jum'at",
    scheduleTime: '18.00 - 20.00',
    segmentsSummary: ['Segmen 1 & 2: Informasi seputar kampus UIN Malang'],
    summary:
      'Program mingguan seputar informasi kampus UIN Malang dan talkshow bersama bintang tamu atau Sobat Siar.',
    flowchartId: 'hk-flow',
  },
  {
    id: 'english-day',
    code: 'ED',
    name: 'English Day (ED)',
    category: 'Daily & Weekly Programs',
    scheduleDay: 'Selasa',
    scheduleTime: '18.00 - 20.00',
    segmentsSummary: ['Segmen 1 & 2: Hal yang lagi trend atau dunia pendidikan'],
    summary:
      'Program mingguan berbahasa Inggris membahas isu tren dan dunia pendidikan.',
    flowchartId: 'ed-ya-shared',
    sharedFlowchartNote:
      'Sesuai dokumen Flowchart Daily (halaman 7), English Day dan Yaumul Arabi menggunakan alur flowchart yang sama.',
  },
  {
    id: 'yaumul-arabi',
    code: 'YA',
    name: 'Yaumul Arabi (YA)',
    category: 'Daily & Weekly Programs',
    scheduleDay: 'Kamis',
    scheduleTime: '18.00 - 20.00',
    segmentsSummary: ['Segmen 1 & 2: Hal yang lagi trend atau dunia pendidikan'],
    summary:
      'Program mingguan berbahasa Arab membahas isu tren dan dunia pendidikan.',
    flowchartId: 'ed-ya-shared',
    sharedFlowchartNote:
      'Sesuai dokumen Flowchart Daily (halaman 7), Yaumul Arabi dan English Day menggunakan alur flowchart yang sama.',
  },
  {
    id: 'freeline',
    code: 'FL',
    name: 'Freeline (FL)',
    category: 'Daily & Weekly Programs',
    scheduleDay: "Senin - Jum'at",
    scheduleTime: '20.00 - 22.00',
    segmentsSummary: ['Segmen 1: SELAM (Absen Malam)', 'Segmen 2: This or That'],
    summary:
      'Program malam santai untuk absen malam dan seru-seruan This or That.',
    flowchartId: 'freeline-flow',
    tandemRuleNote:
      'Aturan dokumen Script Siaran: Program Freeline dibawakan oleh 1 penyiar (pengecualian dari aturan tandem 2 penyiar).',
  },

  // B. Weekend Program
  {
    id: 'simfoni-weekend-show',
    code: 'SWS',
    name: 'Simfoni Weekend Show (SWS)',
    category: 'Weekend Program',
    scheduleDay: 'Sabtu dan Minggu',
    scheduleTime: '08.00 - 12.00 (Flowchart: 06.00 - 12.00 WIB)',
    segmentsSummary: ['1. WEKER', '2. Rekomendasi Sarapan', '3. Lifestyle', '4. Entertainment'],
    summary:
      'Program siaran pagi akhir pekan berdurasi 4 segmen untuk menemani Sabtu dan Minggu.',
    flowchartId: 'sws-flow',
    conflictNotice:
      'Panduan menulis jam 08.00–12.00, sedangkan Flowchart Weekend menulis 06:00–12:00 WIB (Playlist MO 06:00, Indonesia Raya 08:00).',
  },
  {
    id: 'top-chart',
    code: 'TC',
    name: 'Top Chart (TC)',
    category: 'Weekend Program',
    scheduleDay: 'Sabtu',
    scheduleTime: '12.00 - 14.00 WIB',
    segmentsSummary: ['Tangga Lagu HITS SIMFONI (Peringkat 10 sampai 1)'],
    summary:
      'Program khusus Sabtu siang yang mengulas tangga lagu HITS di SIMFONI FM.',
    flowchartId: 'top-chart-flow',
  },
  {
    id: 'daebak',
    name: 'Daebak',
    category: 'Weekend Program',
    scheduleDay: 'Sabtu',
    scheduleTime: '14.00 - 16.00 WIB',
    segmentsSummary: ['Segmen 1: K-pop, idol & musik Korea', 'Segmen 2: Film, aktor/aktris & drama Korea'],
    summary:
      'Dengerin Bareng Musik K-Pop plus bahasan seru seputar drama dan perfilman Korea.',
    flowchartId: 'daebak-flow',
  },
  {
    id: 'lovecast',
    name: 'Lovecast',
    category: 'Weekend Program',
    scheduleDay: 'Sabtu',
    scheduleTime: '18.00 - 20.00',
    segmentsSummary: ['Panduan: Istilah percintaan & Curhat', 'Flowchart: SELAM & This or That'],
    summary:
      'Love Story n Chill Broadcast pada Sabtu malam.',
    flowchartId: 'lovecast-flow',
    conflictNotice:
      'Perbedaan isi segmen: Panduan menulis istilah percintaan & curhat, sedangkan Flowchart tertulis SELAM & This or That.',
  },
  {
    id: 'simfoni-sport',
    code: 'SS',
    name: 'Simfoni Sport (SS)',
    category: 'Weekend Program',
    scheduleDay: 'Minggu',
    scheduleTime: '12.00 - 14.00',
    segmentsSummary: ['Bahas dunia olahraga manca maupun Indonesia & talkshow komunitas bola'],
    summary:
      'Program Minggu siang membahas perkembangan olahraga internasional, nasional, dan komunitas bola.',
    flowchartId: 'sport-flow',
  },
  {
    id: 'fresh-sunday',
    code: 'FS',
    name: 'Fresh Sunday (FS)',
    category: 'Weekend Program',
    scheduleDay: 'Minggu',
    scheduleTime: '14.00 - 16.00 WIB',
    segmentsSummary: ['Bahas lagu-lagu terbaru Indo, Manca, Korea minggu ini (7 s.d. 1)'],
    summary:
      'Program rilisan lagu terbaru setiap Minggu (*catatan dokumen: wajib didampingi MO).',
    flowchartId: 'fresh-sunday-flow',
  },
  {
    id: 'soda',
    name: 'Soda (Siaran bareng sobat muda)',
    category: 'Weekend Program',
    scheduleDay: 'Minggu',
    scheduleTime: 'Panduan: 14.00 - 16.00 · Flowchart: 18.00 - 20.00',
    segmentsSummary: ['Info komunitas di luar kampus UIN Malang'],
    summary:
      'Program siaran bareng komunitas di luar kampus UIN Malang.',
    flowchartId: 'soda-flow',
    conflictNotice:
      'Perbedaan jam: Panduan menulis Minggu 14.00–16.00, sedangkan Flowchart Weekend menulis Minggu 18:00–20:00.',
  },

  // C. Ramadan Program
  {
    id: 'sosmed',
    code: 'Sosmed',
    name: 'Sahur Seru Bareng Sobat Muda (SOSMED)',
    category: 'Ramadan Program',
    scheduleDay: 'Sabtu dan Minggu (Special Ramadhan)',
    scheduleTime: '03.00 - 05.00 WIB (Tabel tertulis 2:05 - 3:55)',
    segmentsSummary: ['Segmen 1: Menyapa & Request Lagu', 'Segmen 2: Interaksi via telepon / GMeet'],
    summary:
      'Program sahur spesial Ramadhan penuh sapaan hangat dan interaksi langsung.',
    flowchartId: 'sosmed-flow',
    conflictNotice:
      'Pada tabel Flowchart Ramadhan kolom waktu tertulis 2:05–3:55 dan keterangan TOH masih bertuliskan "Susu Soda".',
  },
  {
    id: 'iftar',
    code: 'IFTAR',
    name: 'IFTAR (Informasi dan Rekomendasi Takjil dan Ramadhan ala Sobat Siar)',
    category: 'Ramadan Program',
    scheduleDay: 'Setiap hari (Special Ramadhan)',
    scheduleTime: '16.00 - 18.00',
    segmentsSummary: ['Segmen 1: Es Serut (Motivasi Mizan)', 'Segmen 2: Rekomendasi Ngabuburit & Takjil'],
    summary:
      'Program ngabuburit spesial Ramadhan dengan motivasi Islam dan rekomendasi tempat/menu buka puasa.',
    flowchartId: 'iftar-flow',
    conflictNotice:
      'Pada Flowchart Ramadhan beberapa nama slot masih memakai template MIZAN.',
  },
  {
    id: 'kurma',
    code: 'Kurma',
    name: 'KURMA (Kumpulan Cerita Ramadhan)',
    category: 'Ramadan Program',
    scheduleDay: "Senin - Jum'at (Special Ramadhan)",
    scheduleTime: '21.00 - 23.00 WIB (Tabel tertulis 20:05 - 21:55)',
    segmentsSummary: ['Segmen 1: Tradisi Ramadhan Nusantara & Dunia', 'Segmen 2: Freeline This or That / SELAM / Telepon'],
    summary:
      'Program malam Ramadhan berbagi cerita tradisi Ramadhan di Indonesia dan dunia.',
    flowchartId: 'kurma-flow',
    conflictNotice:
      'Kolom Time di tabel Flowchart tertulis 20:05–21:55 dan sebagian label template masih bertuliskan FREELINE.',
  },
];
