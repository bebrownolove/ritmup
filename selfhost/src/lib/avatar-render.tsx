import { createElement as h, type ReactElement, type ReactNode } from "react";
import type { AvatarConfig } from "@/lib/avatar";

/**
 * Персонаж как слои SVG вместо CSS-фигур и текстовых глифов — предсказуемо
 * выглядит на любой платформе и масштабируется без потери деталей.
 * Портировано из макета дизайнера (Создание персонажа.dc.html) почти без
 * изменений: координаты и кривые подобраны на глаз, менять их рискованно.
 */

export const SKIN:Record<string,string> = { porcelain:"#ffe8dc", fair:"#f7cfb2", warm:"#e8ae7d", tan:"#c98252", brown:"#975e3d", deep:"#593827", rose:"#e89aa5", fantasy:"#8bd8c7" };
export const HAIRC:Record<string,string> = { espresso:"#3a251f", black:"#17191d", chestnut:"#70402e", honey:"#dcae4c", copper:"#b9512f", pink:"#e36f9f", blue:"#5175dc", mint:"#4ebda5", silver:"#b9bec9" };
export const BG:Record<string,string> = { mint:"#cdeecb", sky:"#cbe8fa", peach:"#ffd7bd", lemon:"#f8ed9f", lavender:"#ded2f7", rose:"#f7cedb", ocean:"#70c6cf", night:"#26334f", lime:"#bce56d", coral:"#f3907f", sand:"#e8d2a7", graphite:"#697079" };
export const FIT:Record<string,string> = { tee:"#4fb3d9", hoodie:"#58a86a", sweater:"#d98b5f", jacket:"#3f4b5b", sport:"#e0574f", dress:"#c96fa8", shirt:"#eceae4", overalls:"#6b7fb5", punk:"#2b2b30", varsity:"#b3452f", armor:"#8d97a6", space:"#23305a" };
const DARK = "#2c2723";

export function shade(hex:string, amt:number) {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = (v:number) => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
  return "rgb(" + f(r) + "," + f(g) + "," + f(b) + ")";
}

type Box = { x:number; y:number; w:number; h:number; rx:number; cx:number };

function headBox(head:AvatarConfig["head"]):Box {
  const s = ({ round:{w:86,h:84,rx:42}, oval:{w:76,h:92,rx:38}, soft:{w:88,h:84,rx:30}, square:{w:88,h:82,rx:18} } as Record<string,{w:number;h:number;rx:number}>)[head] || { w:86,h:84,rx:42 };
  const y = 130 - s.h;
  return { x: 100 - s.w / 2, y, w: s.w, h: s.h, rx: s.rx, cx: 100 };
}

function wavyEdge(L:number, R:number, B:number, amp:number, n:number) {
  let d = "";
  const step = (R - L) / n;
  for (let i = 0; i < n; i++) {
    const x0 = R - step * i, x1 = R - step * (i + 1);
    d += " Q " + ((x0 + x1) / 2) + " " + (B + amp) + " " + x1 + " " + B;
  }
  return d;
}

function dome(box:Box, bottom:number, amp:number, n:number) {
  const L = box.x - 4, R = box.x + box.w + 4, T = box.y - 8, B = box.y + box.h * bottom;
  let d = "M " + L + " " + B + " C " + L + " " + (T - 12) + ", " + R + " " + (T - 12) + ", " + R + " " + B;
  d += amp ? wavyEdge(L, R, B, amp, n) : " L " + L + " " + B;
  return d + " Z";
}

function hairLayers(cfg:AvatarConfig, box:Box) {
  const c = HAIRC[cfg.hairColor], dk = shade(c, -0.25), out:{back:ReactNode[];front:ReactNode[]} = { back: [], front: [] };
  const style = cfg.hair;
  const bx = box.x - 3, bw = box.w + 6;
  if (style === "bob") out.back.push(h("rect", { key:"bk", x:bx - 2, y:box.y + 2, width:bw + 4, height:box.h * 0.9, rx:26, fill:c }));
  if (style === "long") out.back.push(h("rect", { key:"bk", x:bx - 4, y:box.y + 2, width:bw + 8, height:box.h * 1.3, rx:32, fill:c }));
  if (style === "waves") out.back.push(h("rect", { key:"bk", x:bx - 1, y:box.y + 4, width:bw + 2, height:box.h * 0.66, rx:28, fill:c }));
  if (style === "curls" || style === "messy") out.back.push(h("rect", { key:"bk", x:bx, y:box.y + 4, width:bw, height:box.h * 0.5, rx:24, fill:c }));
  const spec = ({
    short: [0.34, 0, 0], fringe: [0.44, 9, 4], bob: [0.40, 5, 3], long: [0.38, 6, 3],
    curls: [0.34, 0, 0], buns: [0.32, 0, 0], mohawk: [0.20, 0, 0], waves: [0.42, 11, 3],
    shaved: [0.27, 0, 0], messy: [0.36, 8, 5],
  } as Record<string,[number,number,number]>)[style] || [0.34, 0, 0];
  out.front.push(h("path", { key:"hp", d:dome(box, spec[0], spec[1], spec[2]), fill: style === "shaved" ? shade(c, 0.2) : style === "mohawk" ? dk : c }));
  if (style === "mohawk") out.front.push(h("path", { key:"mh", d:"M " + (box.cx - 11) + " " + (box.y + box.h * 0.22) + " C " + (box.cx - 12) + " " + (box.y - 32) + ", " + (box.cx + 12) + " " + (box.y - 32) + ", " + (box.cx + 11) + " " + (box.h * 0.22 + box.y) + " Z", fill:c }));
  if (style === "curls") for (let i = 0; i < 5; i++) out.front.push(h("circle", { key:"c" + i, cx: box.x + 9 + (box.w - 18) * (i / 4), cy: box.y + 2 - (i % 2 ? 2 : 7), r: 9.5, fill: c }));
  if (style === "buns") { out.front.push(h("circle", { key:"b1", cx:box.x + 11, cy:box.y - 7, r:11, fill:c })); out.front.push(h("circle", { key:"b2", cx:box.x + box.w - 11, cy:box.y - 7, r:11, fill:c })); }
  if (style === "messy") for (let i = 0; i < 3; i++) out.front.push(h("circle", { key:"m" + i, cx: box.x + 16 + i * (box.w - 32) / 2, cy: box.y - 3 - (i === 1 ? 6 : 0), r: 8, fill: c }));
  if (style === "short") out.front.push(h("path", { key:"sh", d:"M " + (box.x + 8) + " " + (box.y + 2) + " q " + (box.w * 0.3) + " -14 " + (box.w * 0.52) + " -6", stroke:shade(c, 0.28), strokeWidth:5, strokeLinecap:"round", fill:"none", opacity:0.7 }));
  return out;
}

function eyeGroup(kind:AvatarConfig["eyes"], x:number, y:number, side:"l"|"r") {
  const p:ReactNode[] = [];
  const push = (t:string, o:Record<string,unknown>) => p.push(h(t, Object.assign({ key: side + p.length }, o)));
  if (kind === "dot") push("circle", { cx:x, cy:y, r:4.4, fill:DARK });
  else if (kind === "bright") { push("circle", { cx:x, cy:y, r:6.6, fill:DARK }); push("circle", { cx:x - 2.2, cy:y - 2.4, r:2.1, fill:"#fff" }); }
  else if (kind === "happy") push("path", { d:"M " + (x - 6.5) + " " + (y + 2) + " Q " + x + " " + (y - 7) + " " + (x + 6.5) + " " + (y + 2), stroke:DARK, strokeWidth:3.4, strokeLinecap:"round", fill:"none" });
  else if (kind === "sleepy") push("path", { d:"M " + (x - 6.5) + " " + y + " L " + (x + 6.5) + " " + y, stroke:DARK, strokeWidth:3.4, strokeLinecap:"round" });
  else if (kind === "star") push("path", { d:"M " + x + " " + (y - 7) + " L " + (x + 2.1) + " " + (y - 2.1) + " L " + (x + 7) + " " + y + " L " + (x + 2.1) + " " + (y + 2.1) + " L " + x + " " + (y + 7) + " L " + (x - 2.1) + " " + (y + 2.1) + " L " + (x - 7) + " " + y + " L " + (x - 2.1) + " " + (y - 2.1) + " Z", fill:DARK });
  else if (kind === "wide") { push("circle", { cx:x, cy:y, r:8, fill:"#fff", stroke:DARK, strokeWidth:2 }); push("circle", { cx:x, cy:y + 1, r:3.8, fill:DARK }); }
  else if (kind === "wink") { if (side === "l") { push("circle", { cx:x, cy:y, r:6.2, fill:DARK }); push("circle", { cx:x - 2, cy:y - 2.2, r:2, fill:"#fff" }); } else push("path", { d:"M " + (x - 6.5) + " " + y + " Q " + x + " " + (y + 5) + " " + (x + 6.5) + " " + y, stroke:DARK, strokeWidth:3.2, strokeLinecap:"round", fill:"none" }); }
  else if (kind === "lashes") { push("circle", { cx:x, cy:y, r:6, fill:DARK }); push("circle", { cx:x - 2, cy:y - 2.2, r:1.9, fill:"#fff" });
    for (let i = -1; i <= 1; i++) push("path", { d:"M " + (x + i * 5) + " " + (y - 7) + " L " + (x + i * 6.5) + " " + (y - 12), stroke:DARK, strokeWidth:2, strokeLinecap:"round" }); }
  return p;
}

function mouthShape(kind:AvatarConfig["mouth"], cx:number, y:number):ReactNode[] {
  if (kind === "smile") return [h("path", { key:"m", d:"M " + (cx - 10) + " " + y + " Q " + cx + " " + (y + 10) + " " + (cx + 10) + " " + y, stroke:"#8a3f42", strokeWidth:3.4, strokeLinecap:"round", fill:"none" })];
  if (kind === "grin") return [h("path", { key:"m", d:"M " + (cx - 13) + " " + (y - 2) + " Q " + cx + " " + (y + 14) + " " + (cx + 13) + " " + (y - 2) + " Z", fill:"#8a3f42" }), h("path", { key:"t", d:"M " + (cx - 11) + " " + (y - 1) + " L " + (cx + 11) + " " + (y - 1) + " L " + (cx + 9) + " " + (y + 3) + " L " + (cx - 9) + " " + (y + 3) + " Z", fill:"#fff" })];
  if (kind === "soft") return [h("path", { key:"m", d:"M " + (cx - 7) + " " + y + " Q " + cx + " " + (y + 6) + " " + (cx + 7) + " " + y, stroke:"#8a3f42", strokeWidth:2.6, strokeLinecap:"round", fill:"none" })];
  if (kind === "open") return [h("ellipse", { key:"m", cx:cx, cy:y + 3, rx:7, ry:8, fill:"#8a3f42" }), h("ellipse", { key:"t", cx:cx, cy:y + 8, rx:4, ry:3.4, fill:"#e0757a" })];
  if (kind === "kiss") return [h("ellipse", { key:"m", cx:cx, cy:y + 2, rx:5, ry:6, fill:"#b34c58" })];
  if (kind === "calm") return [h("path", { key:"m", d:"M " + (cx - 8) + " " + (y + 2) + " L " + (cx + 8) + " " + (y + 2), stroke:"#8a3f42", strokeWidth:3, strokeLinecap:"round" })];
  return [h("circle", { key:"m", cx:cx, cy:y + 3, r:5.4, fill:"none", stroke:"#8a3f42", strokeWidth:3 })];
}

function glassesShape(kind:AvatarConfig["glasses"], box:Box, eyeY:number):ReactNode[] {
  if (kind === "none") return [];
  const L = box.cx - 17, R = box.cx + 17, st = { stroke:"#2b3138", strokeWidth:2.6, fill:"none" };
  const bridge = h("path", { key:"br", d:"M " + (box.cx - 6) + " " + eyeY + " L " + (box.cx + 6) + " " + eyeY, stroke:"#2b3138", strokeWidth:2.6 });
  if (kind === "round") return [h("circle", { key:"a", cx:L, cy:eyeY, r:11, ...st }), h("circle", { key:"b", cx:R, cy:eyeY, r:11, ...st }), bridge];
  if (kind === "square") return [h("rect", { key:"a", x:L - 11, y:eyeY - 9, width:22, height:18, rx:5, ...st }), h("rect", { key:"b", x:R - 11, y:eyeY - 9, width:22, height:18, rx:5, ...st }), bridge];
  if (kind === "sun") return [h("rect", { key:"a", x:L - 12, y:eyeY - 9, width:24, height:19, rx:6, fill:"#232a30" }), h("rect", { key:"b", x:R - 12, y:eyeY - 9, width:24, height:19, rx:6, fill:"#232a30" }), bridge];
  if (kind === "heart") return [L, R].map((cx, i) => h("path", { key:"h" + i, d:"M " + cx + " " + (eyeY + 8) + " C " + (cx - 13) + " " + (eyeY - 2) + ", " + (cx - 6) + " " + (eyeY - 11) + ", " + cx + " " + (eyeY - 4) + " C " + (cx + 6) + " " + (eyeY - 11) + ", " + (cx + 13) + " " + (eyeY - 2) + ", " + cx + " " + (eyeY + 8) + " Z", fill:"#e0637f", opacity:0.85 }));
  if (kind === "sport") return [h("rect", { key:"v", x:box.x + 1, y:eyeY - 10, width:box.w - 2, height:20, rx:10, fill:"#3a4550", opacity:0.9 })];
  return [h("circle", { key:"a", cx:R, cy:eyeY, r:11, ...st }), h("path", { key:"c", d:"M " + (R + 10) + " " + (eyeY + 6) + " L " + (R + 16) + " " + (eyeY + 20), stroke:"#2b3138", strokeWidth:2 })];
}

function headwearShape(kind:AvatarConfig["headwear"], box:Box):ReactNode[] {
  const T = box.y, L = box.x - 4, R = box.x + box.w + 4, W = box.w + 8;
  if (kind === "none") return [];
  if (kind === "cap") return [h("path", { key:"c", d:"M " + L + " " + (T + 8) + " C " + (L + 4) + " " + (T - 26) + ", " + (R - 4) + " " + (T - 26) + ", " + R + " " + (T + 8) + " Z", fill:"#e0574f" }), h("rect", { key:"b", x:box.cx - 4, y:T + 4, width:W * 0.62, height:8, rx:4, fill:"#c2453e" })];
  if (kind === "beanie") return [h("path", { key:"c", d:"M " + L + " " + (T + 6) + " C " + (L + 2) + " " + (T - 30) + ", " + (R - 2) + " " + (T - 30) + ", " + R + " " + (T + 6) + " Z", fill:"#d05d70" }), h("rect", { key:"b", x:L - 2, y:T + 2, width:W + 4, height:11, rx:5.5, fill:"#b84a5d" }), h("circle", { key:"p", cx:box.cx, cy:T - 30, r:8, fill:"#f0a8b6" })];
  if (kind === "crown") return [h("path", { key:"c", d:"M " + (L + 8) + " " + (T + 4) + " L " + (L + 8) + " " + (T - 22) + " L " + (box.cx - 14) + " " + (T - 8) + " L " + box.cx + " " + (T - 28) + " L " + (box.cx + 14) + " " + (T - 8) + " L " + (R - 8) + " " + (T - 22) + " L " + (R - 8) + " " + (T + 4) + " Z", fill:"#f0c33c" }), h("circle", { key:"g", cx:box.cx, cy:T - 2, r:4, fill:"#e0637f" })];
  if (kind === "bandana") return [h("rect", { key:"b", x:L, y:T + 2, width:W, height:15, rx:7, fill:"#d54f4f" }), h("path", { key:"k", d:"M " + (R - 4) + " " + (T + 6) + " L " + (R + 12) + " " + (T + 2) + " L " + (R + 9) + " " + (T + 20) + " Z", fill:"#bf4141" })];
  if (kind === "cowboy") return [h("ellipse", { key:"br", cx:box.cx, cy:T + 6, rx:W * 0.78, ry:9, fill:"#a9793f" }), h("path", { key:"d", d:"M " + (L + 10) + " " + (T + 5) + " C " + (L + 12) + " " + (T - 26) + ", " + (R - 12) + " " + (T - 26) + ", " + (R - 10) + " " + (T + 5) + " Z", fill:"#c08d4c" })];
  if (kind === "halo") return [h("ellipse", { key:"h", cx:box.cx, cy:T - 20, rx:26, ry:8, fill:"none", stroke:"#ffd84d", strokeWidth:5 })];
  return [0, 1, 2].map((i) => h("g", { key:"f" + i },
    [0, 1, 2, 3, 4].map((j) => h("circle", { key:j, cx:box.x + 12 + i * (box.w - 24) / 2 + Math.cos(j * 1.256) * 6, cy:T - 2 + Math.sin(j * 1.256) * 6, r:4.6, fill:["#f2a7c3","#fff0a8","#c9e6ff"][i] })).concat([h("circle", { key:"cc", cx:box.x + 12 + i * (box.w - 24) / 2, cy:T - 2, r:3.4, fill:"#f0c33c" })])
  ));
}

function bodyShape(cfg:AvatarConfig):ReactNode[] {
  const c = FIT[cfg.outfit], dk = shade(c, -0.22), lt = shade(c, 0.22), out:ReactNode[] = [];
  const girl = cfg.sex === "girl";
  const L = girl ? 58 : 38, R = girl ? 142 : 162, T = girl ? 152 : 147;
  const ctl = girl ? 26 : 7, ins = girl ? 30 : 20;
  if (cfg.outfit === "hoodie") out.push(h("ellipse", { key:"hd", cx:100, cy:T + 2, rx:girl ? 38 : 44, ry:24, fill:dk }));
  if (cfg.outfit === "dress") out.push(h("path", { key:"sk", d:"M " + (L - 10) + " 200 C " + (L - 6) + " 168 " + (L + 20) + " " + (T + 2) + " 100 " + (T + 2) + " C " + (R - 20) + " " + (T + 2) + " " + (R + 6) + " 168 " + (R + 10) + " 200 Z", fill:lt }));
  out.push(h("path", { key:"bd", d:"M " + L + " 200 C " + L + " " + (T + ctl) + " " + (L + ins) + " " + T + " 100 " + T + " C " + (R - ins) + " " + T + " " + R + " " + (T + ctl) + " " + R + " 200 Z", fill:c }));
  const o = cfg.outfit;
  if (o === "tee") out.push(h("path", { key:"v", d:"M 88 149 L 100 166 L 112 149", fill:"none", stroke:dk, strokeWidth:3.4 }));
  if (o === "hoodie") { out.push(h("path", { key:"n", d:"M 86 152 Q 100 164 114 152", fill:"none", stroke:dk, strokeWidth:4 }));
    out.push(h("path", { key:"s1", d:"M 94 158 L 92 178", stroke:"#f6f3ea", strokeWidth:3, strokeLinecap:"round" }));
    out.push(h("path", { key:"s2", d:"M 106 158 L 108 178", stroke:"#f6f3ea", strokeWidth:3, strokeLinecap:"round" })); }
  if (o === "sweater") { out.push(h("path", { key:"n", d:"M 87 151 Q 100 161 113 151", fill:"none", stroke:dk, strokeWidth:4 }));
    out.push(h("path", { key:"r", d:"M " + (L + 4) + " 192 L " + (R - 4) + " 192", stroke:dk, strokeWidth:5 })); }
  if (o === "jacket") { out.push(h("path", { key:"l1", d:"M 92 150 L 100 200 L 78 200 Z", fill:lt })); out.push(h("path", { key:"l2", d:"M 108 150 L 100 200 L 122 200 Z", fill:lt }));
    out.push(h("path", { key:"z", d:"M 100 158 L 100 200", stroke:"#e8c86a", strokeWidth:2.6 })); }
  if (o === "sport") { out.push(h("path", { key:"s1", d:"M 60 200 L 100 152", stroke:"#fff", strokeWidth:6, strokeLinecap:"round" }));
    out.push(h("path", { key:"s2", d:"M 140 200 L 100 152", stroke:"#fff", strokeWidth:6, strokeLinecap:"round" })); }
  if (o === "dress") { out.push(h("path", { key:"t1", d:"M 90 150 L 88 172", stroke:dk, strokeWidth:4 })); out.push(h("path", { key:"t2", d:"M 110 150 L 112 172", stroke:dk, strokeWidth:4 })); }
  if (o === "shirt") { out.push(h("path", { key:"c1", d:"M 88 150 L 100 166 L 88 168 Z", fill:"#cfcdc5" })); out.push(h("path", { key:"c2", d:"M 112 150 L 100 166 L 112 168 Z", fill:"#cfcdc5" }));
    [176, 190].forEach((y, i) => out.push(h("circle", { key:"bt" + i, cx:100, cy:y, r:2.4, fill:"#b9b6ad" }))); }
  if (o === "overalls") { out.push(h("path", { key:"p1", d:"M 88 150 L 86 176", stroke:lt, strokeWidth:6 })); out.push(h("path", { key:"p2", d:"M 112 150 L 114 176", stroke:lt, strokeWidth:6 }));
    out.push(h("rect", { key:"pk", x:88, y:176, width:24, height:18, rx:4, fill:lt })); }
  if (o === "punk") { [78, 92, 108, 122].forEach((x, i) => out.push(h("circle", { key:"st" + i, cx:x, cy:176, r:2.8, fill:"#cfd4da" })));
    out.push(h("path", { key:"z", d:"M 100 156 L 100 200", stroke:"#cfd4da", strokeWidth:2.4 })); }
  if (o === "varsity") { out.push(h("path", { key:"sl", d:"M " + L + " 200 C " + (L + 2) + " 172 " + (L + 16) + " 156 " + (L + 28) + " " + (T + 4) + " L " + (L + 36) + " 200 Z", fill:"#efe9dc" }));
    out.push(h("path", { key:"sr", d:"M " + R + " 200 C " + (R - 2) + " 172 " + (R - 16) + " 156 " + (R - 28) + " " + (T + 4) + " L " + (R - 36) + " 200 Z", fill:"#efe9dc" }));
    out.push(h("path", { key:"n", d:"M 88 150 Q 100 160 112 150", stroke:"#efe9dc", strokeWidth:4, fill:"none" })); }
  if (o === "armor") { out.push(h("circle", { key:"p1", cx:L + 20, cy:172, r:16, fill:lt })); out.push(h("circle", { key:"p2", cx:R - 20, cy:172, r:16, fill:lt }));
    out.push(h("path", { key:"ch", d:"M 100 156 L 100 200 M 82 174 L 118 174", stroke:dk, strokeWidth:3 })); }
  if (o === "space") { out.push(h("path", { key:"rg", d:"M 78 154 Q 100 168 122 154", stroke:"#d8e4ff", strokeWidth:5, fill:"none" }));
    out.push(h("rect", { key:"pt", x:120, y:172, width:16, height:14, rx:4, fill:"#e0574f" }));
    [82, 92].forEach((x, i) => out.push(h("circle", { key:"lg" + i, cx:x, cy:180, r:3, fill:i ? "#7ee0a8" : "#ffd84d" }))); }
  return out;
}

function accessoryShape(kind:AvatarConfig["accessory"], box:Box):ReactNode[] {
  const eyeY = box.y + box.h * 0.55;
  if (kind === "none") return [];
  if (kind === "chain") return [h("path", { key:"c", d:"M 84 158 Q 100 176 116 158", stroke:"#f0c33c", strokeWidth:3.4, fill:"none" }), h("circle", { key:"g", cx:100, cy:170, r:4, fill:"#f0c33c" })];
  if (kind === "scarf") return [h("rect", { key:"s", x:74, y:146, width:52, height:16, rx:8, fill:"#e05252" }), h("rect", { key:"t", x:104, y:158, width:14, height:26, rx:6, fill:"#c94747" })];
  if (kind === "headphones") return [h("path", { key:"b", d:"M " + (box.x - 6) + " " + eyeY + " C " + (box.x - 6) + " " + (box.y - 24) + ", " + (box.x + box.w + 6) + " " + (box.y - 24) + ", " + (box.x + box.w + 6) + " " + eyeY, stroke:"#323942", strokeWidth:6, fill:"none" }),
    h("rect", { key:"l", x:box.x - 13, y:eyeY - 8, width:14, height:20, rx:6, fill:"#323942" }), h("rect", { key:"r", x:box.x + box.w - 1, y:eyeY - 8, width:14, height:20, rx:6, fill:"#323942" })];
  if (kind === "earbuds") return [h("circle", { key:"l", cx:box.x - 5, cy:eyeY + 4, r:5, fill:"#fff", stroke:"#cfd4da", strokeWidth:1.5 }), h("circle", { key:"r", cx:box.x + box.w + 5, cy:eyeY + 4, r:5, fill:"#fff", stroke:"#cfd4da", strokeWidth:1.5 })];
  if (kind === "bow") return [h("path", { key:"a", d:"M " + (box.x + box.w - 2) + " " + (box.y + 6) + " l 16 -8 l 0 16 Z", fill:"#dd5288" }), h("path", { key:"b", d:"M " + (box.x + box.w - 2) + " " + (box.y + 6) + " l -14 -8 l 0 16 Z", fill:"#dd5288" }), h("circle", { key:"c", cx:box.x + box.w - 2, cy:box.y + 6, r:4, fill:"#c2426f" })];
  if (kind === "badge") return [h("path", { key:"s", d:"M 130 172 l 3.4 7 l 7.6 1 l -5.5 5.4 l 1.3 7.6 l -6.8 -3.6 l -6.8 3.6 l 1.3 -7.6 l -5.5 -5.4 l 7.6 -1 Z", fill:"#f0c33c" })];
  return [h("path", { key:"n", d:"M 84 156 Q 100 172 116 156", stroke:"#cfd4da", strokeWidth:2.4, fill:"none" }), h("path", { key:"g", d:"M 100 166 l 5 6 l -5 6 l -5 -6 Z", fill:"#6fc9d8" })];
}

function detailShapes(cfg:AvatarConfig, box:Box):ReactNode[] {
  const out:ReactNode[] = [], eyeY = box.y + box.h * 0.55;
  const p = cfg.piercing, gold = "#f7c845", edge = "#a97f10";
  const ear = box.x + box.w + 1, noseY = eyeY + 10;
  const gem = (key:string, x:number, y:number, r:number) => h("circle", { key, cx:x, cy:y, r:r, fill:gold, stroke:edge, strokeWidth:1.4 });
  if (p === "stud") out.push(gem("pi", ear, eyeY + 9, 4));
  else if (p === "double") { out.push(gem("pi", ear, eyeY + 4, 3.6)); out.push(gem("pi2", ear, eyeY + 14, 3.6)); }
  else if (p === "hoop") out.push(h("circle", { key:"pi", cx:ear, cy:eyeY + 12, r:6.4, fill:"none", stroke:gold, strokeWidth:3 }));
  else if (p === "nose") out.push(gem("pi", box.cx + 8, noseY - 2, 3));
  else if (p === "brow") { out.push(h("circle", { key:"pi", cx:box.cx + 17, cy:eyeY - 13, r:3.4, fill:gold, stroke:edge, strokeWidth:1.4 }));
    out.push(h("circle", { key:"pi2", cx:box.cx + 24, cy:eyeY - 12, r:3.4, fill:gold, stroke:edge, strokeWidth:1.4 })); }
  else if (p === "septum") out.push(h("path", { key:"pi", d:"M " + (box.cx - 4) + " " + noseY + " a 4 4 0 0 0 8 0", stroke:gold, strokeWidth:2.4, strokeLinecap:"round", fill:"none" }));
  const t = cfg.tattoo, tx = box.cx - 22, ty = eyeY + 16, ink = "#5b6b74";
  const marks:Record<string,string|null> = {
    star: "M " + tx + " " + (ty - 6) + " l 1.9 4.2 l 4.6 .6 l -3.4 3.2 l .9 4.6 l -4 -2.2 l -4 2.2 l .9 -4.6 l -3.4 -3.2 l 4.6 -.6 Z",
    heart: "M " + tx + " " + (ty + 4) + " C " + (tx - 8) + " " + (ty - 3) + ", " + (tx - 3) + " " + (ty - 8) + ", " + tx + " " + (ty - 3) + " C " + (tx + 3) + " " + (ty - 8) + ", " + (tx + 8) + " " + (ty - 3) + ", " + tx + " " + (ty + 4) + " Z",
    bolt: "M " + (tx + 2) + " " + (ty - 7) + " l -6 8 l 4 0 l -2 7 l 7 -9 l -4 0 Z",
    moon: "M " + tx + " " + (ty - 7) + " a 7 7 0 1 0 4 13 a 6 6 0 1 1 -4 -13 Z",
    flower: null, wave: "M " + (tx - 7) + " " + ty + " q 3.5 -5 7 0 q 3.5 5 7 0",
  };
  if (t === "flower") { out.push(h("circle", { key:"tf", cx:tx, cy:ty, r:2.4, fill:ink }));
    [0, 1, 2, 3, 4].forEach((j) => out.push(h("circle", { key:"tp" + j, cx:tx + Math.cos(j * 1.256) * 5, cy:ty + Math.sin(j * 1.256) * 5, r:2.6, fill:ink, opacity:0.8 }))); }
  else if (marks[t]) out.push(h("path", { key:"tt", d:marks[t] as string, fill:t === "wave" ? "none" : ink, stroke:t === "wave" ? ink : "none", strokeWidth:2.2, opacity:0.75 }));
  return out;
}

export type AvatarCrop = readonly [number, number, number, number];

export function renderAvatar(cfg:AvatarConfig, options?:{ crop?:AvatarCrop|null; label?:string }):ReactElement {
  const box = headBox(cfg.head), skin = SKIN[cfg.skin], skinDk = shade(skin, -0.14), girl = cfg.sex === "girl";
  const eyeY = box.y + box.h * 0.55, mouthY = box.y + box.h * 0.85;
  const hair = hairLayers(cfg, box), bg = BG[cfg.background];
  const kids = [
    h("rect", { key:"bg", x:0, y:0, width:200, height:200, rx:34, fill:bg }),
    h("circle", { key:"gl", cx:100, cy:76, r:64, fill:"#fff", opacity:0.22 }),
    h("g", { key:"bh" }, hair.back),
    h("g", { key:"bd" }, bodyShape(cfg)),
    h("rect", { key:"nk", x:girl ? 92.5 : 91, y:box.y + box.h - 12, width:girl ? 15 : 18, height:26, rx:7, fill:skinDk }),
    h("ellipse", { key:"el", cx:box.x + 1, cy:eyeY + 8, rx:8.5, ry:11, fill:skinDk }),
    h("ellipse", { key:"er", cx:box.x + box.w - 1, cy:eyeY + 8, rx:8.5, ry:11, fill:skinDk }),
    h("rect", { key:"hd", x:box.x, y:box.y, width:box.w, height:box.h, rx:box.rx, fill:skin }),
    h("ellipse", { key:"ck1", cx:box.x + 14, cy:mouthY - 4, rx:girl ? 9 : 7, ry:girl ? 6 : 5, fill:"#e0736f", opacity:girl ? 0.34 : 0.2 }),
    h("ellipse", { key:"ck2", cx:box.x + box.w - 14, cy:mouthY - 4, rx:girl ? 9 : 7, ry:girl ? 6 : 5, fill:"#e0736f", opacity:girl ? 0.34 : 0.2 }),
    h("g", { key:"br" }, [
      h("path", { key:"b1", d:"M " + (box.cx - 24) + " " + (eyeY - (girl ? 15 : 13)) + " q 8 " + (girl ? -5 : -3) + " 15 -1", stroke:shade(HAIRC[cfg.hairColor], -0.1), strokeWidth:girl ? 2.6 : 4, strokeLinecap:"round", fill:"none" }),
      h("path", { key:"b2", d:"M " + (box.cx + 24) + " " + (eyeY - (girl ? 15 : 13)) + " q -8 " + (girl ? -5 : -3) + " -15 -1", stroke:shade(HAIRC[cfg.hairColor], -0.1), strokeWidth:girl ? 2.6 : 4, strokeLinecap:"round", fill:"none" }),
    ]),
    girl ? h("g", { key:"ls" }, [-1, 1].map((s) => h("path", { key:s, d:"M " + (box.cx + s * 25) + " " + (eyeY - 4) + " l " + (s * 6) + " -4", stroke:DARK, strokeWidth:2.4, strokeLinecap:"round" }))) : null,
    h("g", { key:"ey" }, eyeGroup(cfg.eyes, box.cx - 17, eyeY, "l").concat(eyeGroup(cfg.eyes, box.cx + 17, eyeY, "r"))),
    h("path", { key:"no", d:"M " + (box.cx - 4) + " " + (eyeY + 5) + " q 4 5 8 0", stroke:shade(skin, -0.28), strokeWidth:2.6, strokeLinecap:"round", fill:"none" }),
    h("g", { key:"mo" }, mouthShape(cfg.mouth, box.cx, mouthY)),
    h("g", { key:"fh" }, hair.front),
    h("g", { key:"dt" }, detailShapes(cfg, box)),
    h("g", { key:"gs" }, glassesShape(cfg.glasses, box, eyeY)),
    h("g", { key:"ac" }, accessoryShape(cfg.accessory, box)),
    h("g", { key:"hw" }, headwearShape(cfg.headwear, box)),
  ];
  const crop = options?.crop;
  const vb = crop ? crop.join(" ") : "0 0 200 200";
  return h("svg", { viewBox:vb, width:"100%", height:"100%", preserveAspectRatio:"xMidYMid slice", style:{ display:"block" }, role:"img", "aria-label":options?.label ?? "Персонаж" }, kids);
}

/** Кроп-окна для превью деталей на плитках выбора — показывают только нужную часть персонажа. */
export const AVATAR_CROPS:Partial<Record<keyof AvatarConfig, AvatarCrop>> = {
  sex: [22,40,156,142], head: [46,24,108,108], hair: [42,14,116,116],
  eyes: [62,58,76,76], mouth: [64,74,72,72], glasses: [54,56,92,92],
  outfit: [34,132,132,66], accessory: [40,108,120,88], headwear: [40,4,120,88],
  piercing: [90,64,78,66], tattoo: [48,82,72,58],
};
export const AVATAR_CROP_OVERRIDE:Partial<Record<keyof AvatarConfig, Partial<Record<string, AvatarCrop>>>> = {
  accessory: { headphones:[34,24,132,112], earbuds:[34,24,132,112], bow:[34,24,132,112] },
};
