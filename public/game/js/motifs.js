/* =========================================================================
 * motifs.js — 场景符号线稿层（方案 B：手绘道具线稿，去 AI 味）
 *
 * 每关 1 组关键道具的极细线稿（手机、碰杯、雨窗、门缝光……），
 * 以低透明度漂浮在色彩场之上、对话层之下，随场景呼吸浮动；
 * cold 场景完全静止（连符号都不动，沉默到底）。
 *
 * 入口：Motifs.show(boxEl, key, { still })  带淡入淡出换场
 * ========================================================================= */

const Motifs = (() => {
  'use strict';

  /* viewBox 0 0 200 200，stroke=currentColor，fill=none */
  const SVGS = {
    /* m1 凌晨卧室 · 亮屏手机 */
    phone: `
      <rect x="72" y="38" width="56" height="118" rx="12"/>
      <rect x="80" y="54" width="40" height="76" rx="4"/>
      <circle cx="100" cy="142" r="3.5"/>
      <circle cx="89" cy="92" r="2.6"/><circle cx="100" cy="92" r="2.6"/><circle cx="111" cy="92" r="2.6"/>`,
    /* m2 办公室工位 · 显示器 + 挂钟 */
    desk: `
      <rect x="42" y="72" width="78" height="52" rx="6"/>
      <line x1="81" y1="124" x2="81" y2="140"/><line x1="62" y1="140" x2="100" y2="140"/>
      <circle cx="148" cy="58" r="17"/>
      <line x1="148" y1="58" x2="148" y2="47"/><line x1="148" y1="58" x2="156" y2="62"/>`,
    /* m3 电影院 · 两张票 */
    tickets: `
      <g transform="rotate(7 100 100)"><rect x="58" y="92" width="92" height="38" rx="6"/></g>
      <g transform="rotate(-8 100 100)">
        <rect x="50" y="78" width="92" height="38" rx="6"/>
        <line x1="112" y1="78" x2="112" y2="116" stroke-dasharray="4 5"/>
      </g>`,
    /* h1 江边晚餐 · 碰杯 */
    cheers: `
      <g transform="rotate(-12 82 92)">
        <path d="M67 62 h30 c0 17 -6 25 -15 25 c-9 0 -15 -8 -15 -25 Z"/>
        <line x1="82" y1="87" x2="82" y2="122"/><line x1="68" y1="122" x2="96" y2="122"/>
      </g>
      <g transform="rotate(12 118 92)">
        <path d="M103 62 h30 c0 17 -6 25 -15 25 c-9 0 -15 -8 -15 -25 Z"/>
        <line x1="118" y1="87" x2="118" y2="122"/><line x1="104" y1="122" x2="132" y2="122"/>
      </g>`,
    /* h2 老街梧桐道 · 长椅 */
    bench: `
      <line x1="48" y1="76" x2="48" y2="124"/><line x1="152" y1="76" x2="152" y2="124"/>
      <line x1="40" y1="90" x2="160" y2="90"/><line x1="40" y1="106" x2="160" y2="106"/>
      <line x1="40" y1="124" x2="160" y2="124"/>
      <line x1="56" y1="124" x2="51" y2="152"/><line x1="144" y1="124" x2="149" y2="152"/>`,
    /* h3 居酒屋 · 灯笼 */
    lantern: `
      <line x1="100" y1="36" x2="100" y2="48"/>
      <rect x="88" y="48" width="24" height="8" rx="2"/>
      <ellipse cx="100" cy="96" rx="34" ry="42"/>
      <path d="M100 54 v84"/>
      <path d="M82 60 c-8 23 -8 49 0 72"/><path d="M118 60 c8 23 8 49 0 72"/>
      <rect x="88" y="138" width="24" height="8" rx="2"/>`,
    /* g1 深夜客厅 · 沙发上的手机 */
    sofa: `
      <path d="M46 102 v-14 c0-6 4-10 10-10 h88 c6 0 10 4 10 10 v14"/>
      <rect x="38" y="102" width="124" height="24" rx="8"/>
      <rect x="31" y="90" width="15" height="42" rx="7"/><rect x="154" y="90" width="15" height="42" rx="7"/>
      <rect x="90" y="90" width="15" height="24" rx="3" transform="rotate(9 97 102)"/>
      <line x1="50" y1="132" x2="50" y2="145"/><line x1="150" y1="132" x2="150" y2="145"/>`,
    /* g2 商场橱窗 · 购物袋 */
    bag: `
      <path d="M62 82 h76 l-6 74 h-64 Z"/>
      <path d="M80 82 v-8 c0-12 9-19 20-19 s20 7 20 19 v8"/>
      <path d="M100 112 c-7 -8 -18 -2 -14 7 c2 5 8 9 14 13 c6 -4 12 -8 14 -13 c4 -9 -7 -15 -14 -7 Z"/>`,
    /* g3 厨房水槽 · 水龙头 + 待洗的碗 */
    sink: `
      <path d="M88 62 v-13 c0-6 4-9 9-9 h12 c6 0 9 4 9 9 v7"/>
      <line x1="118" y1="56" x2="118" y2="64"/>
      <path d="M50 92 h100 v8 c0 16 -12 27 -27 27 h-46 c-15 0 -27 -11 -27 -27 Z"/>
      <ellipse cx="100" cy="99" rx="21" ry="5.5"/>`,
    /* c1 深夜玄关 · 门与门缝光 */
    door: `
      <rect x="64" y="34" width="72" height="132" rx="3"/>
      <circle cx="124" cy="102" r="4"/>
      <line x1="136" y1="34" x2="136" y2="166" stroke-width="3.5"/>
      <line x1="56" y1="166" x2="144" y2="166"/>`,
    /* c2 卧室床沿 · 床 */
    bed: `
      <path d="M46 122 v-40 c0-6 4-10 10-10 h88 c6 0 10 4 10 10 v40"/>
      <rect x="52" y="96" width="34" height="17" rx="8"/>
      <rect x="40" y="120" width="120" height="17" rx="6"/>
      <line x1="50" y1="137" x2="50" y2="151"/><line x1="150" y1="137" x2="150" y2="151"/>`,
    /* c3 雨夜餐厅 · 带雨痕的窗 */
    rainwindow: `
      <rect x="56" y="40" width="88" height="112" rx="4"/>
      <line x1="100" y1="40" x2="100" y2="152"/><line x1="56" y1="96" x2="144" y2="96"/>
      <line x1="71" y1="56" x2="67" y2="73"/><line x1="90" y1="72" x2="86" y2="90"/>
      <line x1="126" y1="58" x2="122" y2="76"/><line x1="134" y1="104" x2="130" y2="122"/>
      <line x1="76" y1="108" x2="72" y2="126"/>`,
    /* d1 阳台夜谈 · 栏杆上的两杯茶 */
    balcony: `
      <line x1="35" y1="102" x2="165" y2="102"/><line x1="35" y1="128" x2="165" y2="128"/>
      <line x1="56" y1="102" x2="56" y2="128"/><line x1="82" y1="102" x2="82" y2="128"/>
      <line x1="118" y1="102" x2="118" y2="128"/><line x1="144" y1="102" x2="144" y2="128"/>
      <path d="M66 86 h17 v9 c0 6 -4 9 -8.5 9 s-8.5 -3 -8.5 -9 Z"/>
      <path d="M117 86 h17 v9 c0 6 -4 9 -8.5 9 s-8.5 -3 -8.5 -9 Z"/>
      <path d="M74 72 c2.5 -3 -2.5 -5 0 -9"/><path d="M125 72 c2.5 -3 -2.5 -5 0 -9"/>`,
    /* d2 父母家餐桌 · 碗筷 */
    table: `
      <line x1="40" y1="112" x2="160" y2="112"/>
      <line x1="53" y1="112" x2="49" y2="152"/><line x1="147" y1="112" x2="151" y2="152"/>
      <path d="M62 96 h25 c0 8 -5.5 12 -12.5 12 s-12.5 -4 -12.5 -12 Z"/>
      <path d="M113 96 h25 c0 8 -5.5 12 -12.5 12 s-12.5 -4 -12.5 -12 Z"/>
      <line x1="63" y1="88" x2="87" y2="82"/><line x1="114" y1="88" x2="138" y2="82"/>`,
    /* d3 深夜床头灯 */
    lamp: `
      <path d="M79 62 h42 l10 33 h-62 Z"/>
      <line x1="100" y1="95" x2="100" y2="142"/>
      <line x1="80" y1="142" x2="120" y2="142"/>
      <line x1="66" y1="66" x2="56" y2="60"/><line x1="134" y1="66" x2="144" y2="60"/>
      <line x1="63" y1="82" x2="52" y2="82"/><line x1="137" y1="82" x2="148" y2="82"/>`,
  };

  const FADE_MS = 380;
  const IMG_CACHE = {};

  function motifColor(tone) {
    return tone === 'light' ? 'rgba(96,70,50,.9)' : 'rgba(255,255,255,.92)';
  }

  function svgString(key, color) {
    const body = SVGS[key] || '';
    /* width/height 480：以高分辨率栅格化，Canvas 放大绘制时保持线条锐利 */
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="480" height="480" fill="none" stroke="${color}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
  }

  /* 将指定符号线稿渲染成 Image 对象，供 Canvas 批量绘制 */
  function loadImage(key, tone) {
    const color = motifColor(tone);
    const cacheKey = `${key}|${tone}`;
    if (IMG_CACHE[cacheKey]) return IMG_CACHE[cacheKey];
    const promise = new Promise((resolve, reject) => {
      const svg = svgString(key, color);
      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('motif load failed: ' + key)); };
      img.src = url;
    });
    IMG_CACHE[cacheKey] = promise;
    return promise;
  }

  function show(box, key, opts = {}) {
    if (!box) return;
    const body = SVGS[key];
    box.classList.add('motif-out');
    setTimeout(() => {
      box.innerHTML = body
        ? `<svg viewBox="0 0 200 200" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`
        : '';
      box.classList.toggle('motif-still', !!opts.still);
      box.classList.remove('motif-out');
    }, FADE_MS);
  }

  return { show, SVGS, loadImage, motifColor };
})();

window.Motifs = Motifs;
