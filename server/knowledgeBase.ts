/**
 * Knowledge Base Resmi SIMFONI FM untuk AI Studio (Server-Side)
 * Sumber utama:
 * - panduan_program__highlight__dan_script_siaran_simfoni_fm_ba3e6621.pdf
 *
 * ATURAN KETAT:
 * 1. Pedoman AI Highlight (Bagian B dokumen) dan Pedoman AI Script (Bagian C dokumen)
 *    dipisahkan secara tegas dan TIDAK BOLEH dicampur.
 * 2. Penyesuaian istilah CIMPO LOVERZ: sapaan pendengar memakai "Sobat Siar"
 *    (dokumen asli tertulis "sobat muda", ditandai untuk keseragaman aplikasi).
 */

export const KNOWLEDGE_BASE_REFS = {
  HIGHLIGHT_RULES_AND_EXAMPLE:
    'panduan_program__highlight__dan_script_siaran_simfoni_fm_ba3e6621.pdf (Bagian B: Aturan, Format Paten & Contoh Highlight)',
  SCRIPT_RULES:
    'panduan_program__highlight__dan_script_siaran_simfoni_fm_ba3e6621.pdf (Bagian C: Aturan Script Siaran)',
  PROGRAMS_GUIDE:
    'panduan_program__highlight__dan_script_siaran_simfoni_fm_ba3e6621.pdf (Bagian A) + FLOWCHART_2026 (Daily, Weekend, MarhabanYaRamadhan)',
};

export const HIGHLIGHT_KNOWLEDGE_CONTEXT = `
PEDOMAN RESMI SIMFONI HIGHLIGHT (Dari Dokumen Bagian B: Highlight):

1. ATURAN PENYUSUNAN:
   - Beritanya wajib mencakup unsur 5W+1H (Apa, Siapa, Kapan, Di mana, Mengapa, Bagaimana) sesuai fakta sumber.
   - Disampaikan dengan bahasa Indonesia yang tidak baku, tapi tetap semiformal.
   - Menggunakan gaya siaran radio anak muda yang jelas dan enak didengar saat on-air.
   - Gunakan sapaan pendengar "Sobat Siar" (catatan penyesuaian CIMPO LOVERZ dari dokumen asli).
   - Jangan terlalu panjang: cukup sekitar 4 - 8 baris saja per isi berita (ringkas, padat, bukan artikel panjang).
   - DILARANG mengarang fakta, angka, nama, kutipan, atau sumber berita yang tidak ada di berita sumber.

2. FORMAT PATEN SIMFONI HIGHLIGHT (WAJIB DIIKUTI):
   - Kalimat pembuka paten (openerLine): "Selengkapnya hanya di Simfoni Highlight barengan [Nama Penyiar]."
   - Isi berita 1: diawali "Sobat Siar, ..." lalu inti berita 5W1H sepanjang 4 - 8 baris dengan bahasa semiformal santai.
   - Jika terdapat 2 berita (atau 2 sudut berita utama): sertakan jeda pemisah lalu isi berita ke-2 yang tetap ringkas 4 - 8 baris.
   - Kalimat penutup paten (closerLine): "Itu tadi Simfoni Highlight buat kamu, saatnya kita move ke Lalu Lalang."

3. CONTOH REFERENSI GAYA & ALUR (JANGAN DISALIN MENTAH, JADIKAN ACUAN STRUKTUR & NADA):
   [Judul Berita 2 / Teaser]: Prabowo Ingin Percepat Pemilihan Wapres Pengganti Gibran
   [Opener Paten]: Selengkapnya hanya di Simfoni Highlight barengan Railey.
   [Judul Berita 1]: Airlangga Respons Kekhawatiran Investor soal Mundurnya Gibran
   [Isi Berita 1]: Sobat Siar, kabar mundurnya Gibran Rakabuming Raka dari jabatan Wakil Presiden ternyata ikut jadi perhatian para investor. Menanggapi hal ini, Menteri Koordinator Bidang Perekonomian Airlangga Hartarto bilang kalau investor nggak perlu terlalu khawatir dengan kondisi politik Indonesia. Menurutnya, para investor lebih melihat gimana kondisi dan peluang ekonomi Indonesia ke depannya. Airlangga juga memastikan pemerintah tetap fokus menjaga stabilitas ekonomi dan menarik investasi. Jadi, pemerintah berharap situasi politik ini nggak sampai mengganggu kepercayaan investor.
   [Jeda]: —
   [Isi Berita 2]: Masih berkaitan dengan mundurnya Gibran, Presiden Prabowo ternyata ingin proses pemilihan Wakil Presiden pengganti bisa segera dilakukan...
   [Closer Paten]: Itu tadi Simfoni Highlight buat kamu, saatnya kita move ke Lalu Lalang.
`.trim();

export const SCRIPT_KNOWLEDGE_CONTEXT = `
PEDOMAN RESMI SCRIPT SIARAN SIMFONI FM (Dari Dokumen Bagian C: Script Siaran + Ketentuan AI Script):

1. KETENTUAN PENYIAR:
   - Secara umum menggunakan 2 penyiar (Tandem), KECUALI Program Freeline (1 penyiar). Tetap ikuti jumlah penyiar yang diinput pengguna.
   - Pembagian dialog antarpenyiar harus RATA dan seimbang. Kedua penyiar saling menanggapi ucapan rekannya, bukan bergantian membacakan info satu arah.
   - Setiap giliran bicara tetap SINGKAT dan natural (1 - 3 kalimat per giliran, jangan monolog panjang), namun jumlah keseluruhan giliran harus cukup untuk memenuhi target durasi talk.
   - Interaksi saat talk bersifat 3 ARAH: penyiar 1, penyiar 2 (bila tandem), dan pendengar "Sobat Muda" saling terhubung.

2. ATURAN OPENING, ISI, DAN CLOSING:
   - SEGMEN PERTAMA (OPENING / TOH):
     * WAJIB diawali salam pembuka, misalnya "Assalamualaikum warahmatullahi wabarakatuh".
     * Setelah salam, langsung sapa pendengar dengan panggilan "Sobat Muda".
     * Perkenalkan nama penyiar, nama program, tema siaran, dan informasi durasi program jika tersedia.
     * Sertakan tagline resmi SIMFONI FM: "107,7 SIMFONI FM The power hits station, dengerin lagu enak pilihanmu".
     * Gunakan bahasa siaran yang natural dan mengalir menuju pembahasan tema.
   - SEGMEN ISI (Talk 1, Talk 2, Talk 3, dll):
     * Pembahasan tema harus berkembang secara mendalam — jangan hanya pengantar singkat lalu langsung pindah segmen.
     * Kembangkan percakapan secara alami sesuai tema melalui: penjelasan dan pengembangan sudut pandang tiap penyiar, tanggapan langsung terhadap ucapan rekan penyiar, pertanyaan ringan, contoh kejadian sehari-hari atau situasi dekat dengan kehidupan Sobat Muda, informasi/fakta relevan bila perlu, serta transisi natural ke bahasan berikutnya.
     * Jangan memaksakan semua unsur dalam satu talk sekaligus, dan JANGAN mengulang gagasan yang sama atau basa-basi kosong demi mengejar jumlah kata.
   - SEGMEN PENUTUP (CLOSING):
     * Berisi rangkuman singkat pembahasan, pesan penutup yang hangat untuk Sobat Muda, dan ucapan terima kasih karena sudah mendengarkan.
     * Aturan salam Closing dari dokumen:
       - Jika Closing Segmen 1 (masih lanjut ke segmen/jam berikutnya): TIDAK PERLU salam pamit akhir, cukup jembatan ke lagu/segmen selanjutnya.
       - Jika Closing Segmen 2 / Segmen Akhir (selesai program): WAJIB memakai salam penutup resmi: "([Penyiar 1] pamit, [Penyiar 2 jika ada] pamit, wassalamualaikum warahmatullahi wabarakatuh, salam peace dan kreasi)".

3. TARGET DURASI PER TALK (110 - 130 KATA PER MENIT):
   - Jadikan durasi menit yang diminta pengguna sebagai acuan utama panjang script per talk.
   - Gunakan laju bicara siaran sekitar 110 - 130 kata per menit (dihitung dari total dialog seluruh penyiar dalam talk tersebut):
     * 1 menit ≈ 110 - 130 kata
     * 2 menit ≈ 220 - 260 kata
     * 3 menit ≈ 330 - 390 kata
     * 4 menit ≈ 440 - 520 kata
   - Jangan membuat talk jauh lebih pendek dari target durasinya.

4. GAYA BAHASA & LARANGAN KETAT:
   - Panggilan pendengar di AI Script WAJIB konsisten: "Sobat Muda". DILARANG menggunakan "Sobat Siar" di AI Script.
   - WAJIB memakai kata "kita" (JANGAN memakai kata "kami") ketika penyiar berbicara mewakili dirinya bersama rekan penyiar atau SIMFONI FM (kecuali saat mengutip pernyataan pihak ketiga).
   - Gunakan bahasa nonformal, bahasa siaran radio anak muda yang santai, ramah, dan komunikatif.
   - Gunakan panggilan "aku" dan "kamu". DILARANG KERAS memakai "lo" / "gue", dan hindari kata "kalian".
   - DILARANG menggunakan bahasa kasar.
   - Script harus terasa seperti obrolan spontan dua sahabat di studio, BUKAN tulisan AI.
   - Hindari pengulangan kata "nah" secara berlebihan dan hindari transisi klise AI ("Selain itu", "Lebih lanjut", "Menariknya", "Di sisi lain", "Tak dapat dipungkiri").
   - Ajakan streaming cukup diletakkan di bagian akhir (Closing akhir) jika relevan.
`.trim();
